import { describe, expect, it } from "vitest";
import type { ExerciseTemplate, HevySet, HevyWorkout, Profile } from "../src/lib/engine/types";
import { classifyAll, classifyWorkout, muscleVolume, performancesByTemplate, toTemplateMap } from "../src/lib/engine/history";
import { decideToday, readinessScore } from "../src/lib/engine/schedule";
import { buildStrengthWorkout, formatWeight, prescribe } from "../src/lib/engine/workout";
import { bmr, hrThreshold, minutesAbove, nutritionTargets, recalibrate, weightTrendPerWeek } from "../src/lib/engine/nutrition";
import { buildDailyPlan } from "../src/lib/engine/plan";
import { addDays, weekStart } from "../src/lib/engine/time";

const T = (id: string, primary: string, equipment = "machine", secondary: string[] = [], type = "weight_reps"): ExerciseTemplate => ({
  id,
  title: id,
  type,
  primary_muscle_group: primary,
  secondary_muscle_groups: secondary,
  equipment,
});

const templates = [
  T("db_bench", "chest", "dumbbell", ["triceps", "shoulders"]),
  T("incline_db", "chest", "dumbbell", ["triceps"]),
  T("cable_fly", "chest"),
  T("pulldown", "lats", "machine", ["biceps"]),
  T("row", "upper_back", "machine", ["biceps"]),
  T("db_press", "shoulders", "dumbbell", ["triceps"]),
  T("lateral", "shoulders", "dumbbell"),
  T("curl", "biceps", "dumbbell"),
  T("pressdown", "triceps"),
  T("ab_roller", "abdominals", "other"),
  T("squat", "quadriceps", "machine", ["glutes"]),
  T("rdl", "hamstrings", "dumbbell", ["glutes"]),
  T("leg_ext", "quadriceps"),
  T("leg_curl", "hamstrings"),
  T("calf", "calves"),
  T("treadmill", "cardio", "machine", [], "distance_duration"),
  T("kb_swing", "full_body", "kettlebell"),
  T("farmers", "full_body", "other", [], "short_distance_weight"),
];
const tmap = toTemplateMap(templates);

const set = (w: number | null, r: number | null, extra: Partial<HevySet> = {}): HevySet => ({
  type: "normal",
  weight_kg: w,
  reps: r,
  distance_meters: null,
  duration_seconds: null,
  rpe: null,
  ...extra,
});

let n = 0;
function workout(day: string, exercises: [string, HevySet[]][]): HevyWorkout {
  return {
    id: `w${n++}`,
    title: "t",
    start_time: `${day}T12:00:00+00:00`,
    end_time: `${day}T13:20:00+00:00`,
    exercises: exercises.map(([id, sets]) => ({ title: id, exercise_template_id: id, sets })),
  };
}
const upper = (day: string) =>
  workout(day, [
    ["db_bench", [set(80, 8), set(80, 8), set(80, 7)]],
    ["pulldown", [set(70, 9), set(70, 8), set(70, 8)]],
    ["lateral", [set(20, 12), set(20, 11), set(20, 10)]],
  ]);
const legs = (day: string) =>
  workout(day, [
    ["squat", [set(110, 7), set(110, 6)]],
    ["rdl", [set(72, 8), set(72, 8)]],
    ["leg_ext", [set(45, 12), set(45, 12)]],
  ]);
const circuit = (day: string) =>
  workout(day, [
    ["treadmill", [set(null, null, { duration_seconds: 900, distance_meters: 2000 })]],
    ["kb_swing", [set(24, 15), set(24, 15), set(24, 15)]],
    ["farmers", [set(25, null, { distance_meters: 40 }), set(25, null, { distance_meters: 40 })]],
  ]);

const profile: Profile = {
  sex: "male",
  age: 27,
  heightCm: 174,
  weightKg: 80,
  timezone: "UTC",
  phaseStart: null,
  calorieAdjust: 0,
  lastRecalibration: null,
  foods: ["rice", "pork", "eggs"],
};

describe("time", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-17")).toBe("2026-11-16"); // Tue → Mon
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sun → Mon
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("classification", () => {
  it("classifies upper, legs and circuit sessions", () => {
    expect(classifyWorkout(upper("2026-11-02"), tmap)).toBe("upper");
    expect(classifyWorkout(legs("2026-11-02"), tmap)).toBe("legs");
    expect(classifyWorkout(circuit("2026-11-02"), tmap)).toBe("circuit");
  });
  it("a short treadmill finisher doesn't turn an upper day into a circuit", () => {
    const w = upper("2026-11-02");
    w.exercises.push({ title: "treadmill", exercise_template_id: "treadmill", sets: [set(null, null, { duration_seconds: 600 })] });
    expect(classifyWorkout(w, tmap)).toBe("upper");
  });
  it("ignores warm-up sets and counts secondaries as half", () => {
    const w = workout("2026-11-02", [["db_bench", [set(40, 10, { type: "warmup" }), set(80, 8), set(80, 8)]]]);
    const vol = muscleVolume(classifyAll([w], tmap, "UTC"), tmap, "2026-11-01", "2026-11-07");
    expect(vol.chest).toBe(2);
    expect(vol.triceps).toBe(1);
  });
});

describe("decideToday", () => {
  const today = "2026-11-18"; // Wednesday
  const run = (ws: HevyWorkout[], ci = null as Parameters<typeof decideToday>[2]) =>
    decideToday(classifyAll(ws, tmap, "UTC"), today, ci);

  it("prioritises upper when everything is due and recovered", () => {
    const d = run([legs("2026-11-10")]);
    expect(d.action).toBe("train");
    expect(d.session).toBe("upper_a");
  });

  it("needs 48h between upper sessions, so it picks legs the day after upper", () => {
    const d = run([upper("2026-11-17")]);
    expect(d.session).toBe("legs");
  });

  it("second upper of the week is Upper B", () => {
    const d = run([upper("2026-11-16"), legs("2026-11-17")]);
    expect(d.session).toBe("upper_b");
  });

  it("rests after 3 days in a row", () => {
    const d = run([upper("2026-11-15"), legs("2026-11-16"), circuit("2026-11-17")]);
    expect(d.action).toBe("rest");
  });

  it("rests on low readiness", () => {
    const d = run([], { date: today, sleep: 1, soreness: 5, energy: 2 });
    expect(readinessScore({ date: today, sleep: 1, soreness: 5, energy: 2 })).toBe(1.3);
    expect(d.action).toBe("rest");
  });

  it("very sore but OK energy → circuit", () => {
    const d = run([], { date: today, sleep: 4, soreness: 4, energy: 4 });
    expect(d.session).toBe("circuit");
  });

  it("rests when the weekly target is met", () => {
    const d = run([upper("2026-11-16"), legs("2026-11-17")].concat([]), null);
    expect(d.action).toBe("train");
    const all = decideToday(
      classifyAll([upper("2026-11-16"), circuit("2026-11-17"), upper("2026-11-19"), legs("2026-11-20")], tmap, "UTC"),
      "2026-11-22",
      null,
    );
    expect(all.action).toBe("rest");
    expect(all.reasons[0]).toMatch(/target/);
  });

  it("reports done when a workout is already logged today", () => {
    const d = run([upper(today)]);
    expect(d.action).toBe("done");
    expect(d.category).toBe("upper");
  });
});

describe("prescribe (double progression)", () => {
  const slot = { muscles: ["chest"], kind: "compound" as const, sets: 3 };
  const t = tmap.get("db_bench")!;
  const perf = (sets: HevySet[], day = "2026-11-10") => [{ day, sets }];

  it("adds 2 kg per hand when every set hits the top of the range", () => {
    const p = prescribe(t, perf([set(80, 10), set(80, 10), set(80, 10)]), slot, false);
    expect(p.action).toBe("increase");
    expect(p.loggedWeightKg).toBe(84);
    expect(p.displayWeight).toBe("42 kg each (log 84)");
  });

  it("holds the weight and adds a rep otherwise", () => {
    const p = prescribe(t, perf([set(84, 7), set(84, 6), set(84, 6)]), slot, false);
    expect(p.action).toBe("hold");
    expect(p.loggedWeightKg).toBe(84);
    expect(p.targetReps).toBe(8);
  });

  it("doesn't add load if RPE says the sets were a grind", () => {
    const p = prescribe(t, perf([set(80, 10, { rpe: 10 }), set(80, 10, { rpe: 10 }), set(80, 10, { rpe: 9.5 })]), slot, false);
    expect(p.action).toBe("hold");
  });

  it("reduces load when reps fall below the range", () => {
    const p = prescribe(t, perf([set(84, 4), set(84, 3)]), slot, false);
    expect(p.action).toBe("reduce");
    expect(p.loggedWeightKg!).toBeLessThan(84);
  });

  it("backs off ~10% after two consecutive declines", () => {
    const hist = [
      { day: "2026-11-12", sets: [set(84, 6)] },
      { day: "2026-11-05", sets: [set(84, 7)] },
      { day: "2026-10-29", sets: [set(84, 8)] },
    ];
    const p = prescribe(t, hist, slot, false);
    expect(p.action).toBe("reduce");
    expect(p.loggedWeightKg).toBe(76);
  });

  it("deload halves sets and uses ~90% load", () => {
    const p = prescribe(t, perf([set(80, 8), set(80, 8), set(80, 8)]), slot, true);
    expect(p.sets).toBe(2);
    expect(p.loggedWeightKg).toBe(72);
    expect(p.action).toBe("deload");
  });

  it("formats bodyweight-weighted and barbell loads", () => {
    expect(formatWeight(T("dip", "chest", "machine", [], "bodyweight_weighted"), 15)).toBe("BW + 15 kg");
    expect(formatWeight(T("bb", "chest", "barbell"), 100)).toBe("100 kg");
  });
});

describe("workout builder", () => {
  it("fills upper slots from the exercises used most, A vs B variants", () => {
    const ws = [upper("2026-11-02"), upper("2026-11-05"), workout("2026-11-07", [["incline_db", [set(64, 8)]], ["cable_fly", [set(30, 12)]]])];
    const perf = performancesByTemplate(classifyAll(ws, tmap, "UTC"));
    const a = buildStrengthWorkout("upper_a", tmap, perf, "2026-11-10", false);
    const b = buildStrengthWorkout("upper_b", tmap, perf, "2026-11-10", false);
    expect(a.exercises[0].templateId).toBe("db_bench");
    expect(b.exercises[0].templateId).toBe("incline_db");
    expect(a.notes.some((x) => x.includes("upper_back"))).toBe(true); // no row history → note
  });

  it("legs are maintenance: 2 sets per exercise", () => {
    const perf = performancesByTemplate(classifyAll([legs("2026-11-02")], tmap, "UTC"));
    const w = buildStrengthWorkout("legs", tmap, perf, "2026-11-10", false);
    expect(w.exercises.every((e) => e.sets === 2)).toBe(true);
  });
});

describe("nutrition", () => {
  it("Mifflin-St Jeor for 27 y, 174 cm, 80 kg male", () => {
    expect(Math.round(bmr(profile, 80))).toBe(1758);
  });

  it("rest day vs lifting day targets", () => {
    const rest = nutritionTargets(profile, "rest", 80, null);
    const lift = nutritionTargets(profile, "lift", 80, null);
    expect(rest.kcal).toBe(2360);
    expect(lift.kcal).toBe(2790);
    expect(rest.proteinG).toBe(144);
    expect(lift.proteinG).toBe(144);
    expect(lift.carbsG).toBeGreaterThan(rest.carbsG);
    // calories add up
    expect(lift.proteinG * 4 + lift.carbsG * 4 + lift.fatG * 9).toBeCloseTo(lift.kcal, -1);
  });

  it("steps nudge calories, capped at ±250", () => {
    expect(nutritionTargets(profile, "rest", 80, 10000).kcal).toBe(2560);
    expect(nutritionTargets(profile, "rest", 80, 30000).kcal).toBe(2610);
  });

  it("weight trend and recalibration", () => {
    const flat = [
      { date: "2026-10-20", weightKg: 80 },
      { date: "2026-10-27", weightKg: 80.1 },
      { date: "2026-11-03", weightKg: 80 },
      { date: "2026-11-10", weightKg: 80.1 },
    ];
    expect(weightTrendPerWeek(flat)!).toBeLessThan(0.1);
    const r = recalibrate(flat, 0, null, "2026-11-10");
    expect(r.changed).toBe(true);
    expect(r.adjust).toBe(150);
    expect(recalibrate(flat, 150, "2026-11-08", "2026-11-10").changed).toBe(false);

    const fast = flat.map((w, i) => ({ ...w, weightKg: 80 + i * 0.7 }));
    expect(recalibrate(fast, 0, null, "2026-11-10").adjust).toBe(-150);
  });

  it("heart-rate threshold and minutes above it", () => {
    expect(hrThreshold(27)).toBe(119 + 13); // 0.7 × (208 − 18.9) ≈ 132
    const s = Array.from({ length: 21 }, (_, i) => ({ ts: new Date(Date.UTC(2026, 10, 8, 12, i)).toISOString(), bpm: i < 15 ? 150 : 100 }));
    expect(minutesAbove(s, "2026-11-08T12:00:00Z", "2026-11-08T12:30:00Z", 132)).toBe(15);
  });
});

describe("buildDailyPlan", () => {
  it("produces a cited plan with a deload in phase week 1", () => {
    const plan = buildDailyPlan({
      today: "2026-11-18",
      profile: { ...profile, phaseStart: "2026-11-16" },
      workouts: [upper("2026-11-12"), legs("2026-11-14"), circuit("2026-11-15")],
      templates,
      checkIn: { date: "2026-11-18", sleep: 4, soreness: 2, energy: 4 },
      weighIns: [],
      health: [],
      hr: [],
    });
    expect(plan.decision.session).toBe("upper_a");
    expect(plan.phase.deload).toBe(true);
    expect(plan.workout!.exercises.every((e) => e.action === "deload" || e.action === "new")).toBe(true);
    expect(plan.nutrition.dayType).toBe("lift");
    const ids = plan.sources.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["bell2023deload", "mifflin1990", "morton2018protein", "acsm2009"]));
    expect(plan.warnings.some((w) => w.includes("weigh-in"))).toBe(true);
  });
});

import { parseLocaleNumber } from "../src/lib/parse";
describe("parseLocaleNumber", () => {
  it("handles Shortcuts locale formats", () => {
    expect(parseLocaleNumber("8,412")).toBe(8412);
    expect(parseLocaleNumber("72,5")).toBe(72.5);
    expect(parseLocaleNumber("72.5")).toBe(72.5);
    expect(parseLocaleNumber("8 412")).toBe(8412);
    expect(parseLocaleNumber("8.412", { integer: true })).toBe(8412);
    expect(parseLocaleNumber(140)).toBe(140);
  });
});
