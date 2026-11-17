import type { CheckIn, ExerciseTemplate, HealthDay, HevyWorkout, HrSample, Profile, WeighIn } from "./types";
import { classifyAll, muscleVolume, performancesByTemplate, toTemplateMap } from "./history";
import { decideToday, type Decision } from "./schedule";
import { groupStatus, type GroupStatus } from "./volume";
import { buildCircuit, buildStrengthWorkout, type CircuitItem, type WorkoutPlan } from "./workout";
import {
  avgSteps,
  currentWeight,
  dayTypeFor,
  hrThreshold,
  minutesAbove,
  nutritionTargets,
  type NutritionTargets,
} from "./nutrition";
import { addDays, daysBetween } from "./time";
import { sourcesFor, type Source } from "../sources";

export interface DailyPlan {
  date: string;
  phase: { name: string; deload: boolean; detail: string };
  decision: Decision;
  workout: WorkoutPlan | null;
  circuit: { items: CircuitItem[]; rounds: number; notes: string[] } | null;
  volume: GroupStatus[];
  nutrition: NutritionTargets;
  lastCircuitHr: { day: string; minutesAbove: number | null; threshold: number } | null;
  warnings: string[];
  sources: Source[];
}

export interface PlanInputs {
  today: string;
  profile: Profile;
  workouts: HevyWorkout[];
  templates: ExerciseTemplate[];
  checkIn: CheckIn | null;
  weighIns: WeighIn[];
  health: HealthDay[];
  hr: HrSample[];
}

export function phaseFor(profile: Profile, today: string) {
  if (!profile.phaseStart) {
    return { name: "Not started", deload: false, detail: "Set a Phase 1 start date in Settings to begin with a deload week." };
  }
  const d = daysBetween(profile.phaseStart, today);
  if (d >= 0 && d < 7)
    return { name: "Phase 1, week 1: deload", deload: true, detail: `Day ${d + 1} of 7. Lighter and fewer sets to clear fatigue.` };
  return {
    name: `Phase 1: rebalance and progress (week ${Math.floor(d / 7) + 1})`,
    deload: false,
    detail: "More shoulder and triceps work, abs capped, double progression on every lift.",
  };
}

export function buildDailyPlan(input: PlanInputs): DailyPlan {
  const { today, profile } = input;
  const tz = profile.timezone;
  const templates = toTemplateMap(input.templates);
  const classified = classifyAll(input.workouts, templates, tz);
  const perf = performancesByTemplate(classified);

  const vol = muscleVolume(classified, templates, addDays(today, -6), today);
  const volume = groupStatus(vol);
  const decision = decideToday(classified, today, input.checkIn);
  const phase = phaseFor(profile, today);

  let workout: WorkoutPlan | null = null;
  let circuit: DailyPlan["circuit"] = null;
  if (decision.action === "train" && decision.session) {
    if (decision.session === "circuit") circuit = buildCircuit(templates, perf, today, phase.deload);
    else workout = buildStrengthWorkout(decision.session, templates, perf, today, phase.deload);
  }

  const weightKg = currentWeight(profile, input.weighIns);
  const nutrition = nutritionTargets(profile, dayTypeFor(decision.action === "rest" ? null : decision.category), weightKg, avgSteps(input.health, today));

  const lastCirc = [...classified].reverse().find((c) => c.category === "circuit");
  const threshold = hrThreshold(profile.age);
  const lastCircuitHr = lastCirc
    ? { day: lastCirc.day, minutesAbove: minutesAbove(input.hr, lastCirc.workout.start_time, lastCirc.workout.end_time, threshold), threshold }
    : null;

  const warnings: string[] = [];
  const abs = volume.find((v) => v.group.id === "abs");
  if (abs && abs.status === "over") warnings.push(`Abs got ${abs.sets} sets this week (cap 8). That recovery budget is better spent on shoulders and triceps.`);
  for (const v of volume) {
    if (v.group.category === "upper" && v.status === "under" && decision.category === "upper")
      warnings.push(`${v.group.label}: ${v.sets} sets in the last 7 days (target ${v.group.min}-${v.group.max}).`);
  }
  const lastWeighIn = [...input.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!lastWeighIn || daysBetween(lastWeighIn.date, today) >= 7) warnings.push("Weekly weigh-in due. Weigh in the morning before eating.");
  const anyRpe = input.workouts.some((w) => w.exercises.some((e) => e.sets.some((s) => s.rpe !== null)));
  if (!anyRpe) warnings.push("No RPE logged yet. Turn it on in Hevy (Settings → Workouts) and log it on your first 2-3 lifts.");

  const ids = new Set<string>([...decision.sourceIds, ...nutrition.sourceIds, ...volume.flatMap((v) => v.group.sourceIds)]);
  workout?.exercises.forEach((e) => e.sourceIds.forEach((s) => ids.add(s)));
  if (phase.deload) ids.add("bell2023deload");
  if (circuit || lastCircuitHr) { ids.add("tanaka2001"); ids.add("who2020"); }

  return { date: today, phase, decision, workout, circuit, volume, nutrition, lastCircuitHr, warnings, sources: sourcesFor(ids) };
}
