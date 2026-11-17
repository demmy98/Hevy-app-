import type { ExerciseTemplate, HevySet, SessionKind } from "./types";
import { bestE1rm, e1rm, type Performance, type TemplateMap } from "./history";
import { daysBetween } from "./time";

export interface Slot {
  muscles: string[];
  kind: "compound" | "isolation" | "any";
  sets: number;
}

const UPPER_SLOTS: Slot[] = [
  { muscles: ["chest"], kind: "compound", sets: 3 },
  { muscles: ["lats"], kind: "any", sets: 3 },
  { muscles: ["chest"], kind: "any", sets: 3 },
  { muscles: ["upper_back"], kind: "any", sets: 3 },
  { muscles: ["shoulders"], kind: "compound", sets: 3 },
  { muscles: ["shoulders"], kind: "isolation", sets: 3 },
  { muscles: ["biceps"], kind: "any", sets: 3 },
  { muscles: ["triceps"], kind: "any", sets: 3 },
  { muscles: ["abdominals"], kind: "any", sets: 2 },
];

// Maintenance: ~8 hard sets across quads/hamstrings/glutes.
const LEG_SLOTS: Slot[] = [
  { muscles: ["quadriceps"], kind: "compound", sets: 2 },
  { muscles: ["hamstrings", "glutes"], kind: "compound", sets: 2 },
  { muscles: ["quadriceps"], kind: "isolation", sets: 2 },
  { muscles: ["hamstrings"], kind: "isolation", sets: 2 },
  { muscles: ["calves"], kind: "any", sets: 2 },
];

const STRENGTH_TYPES = new Set(["weight_reps", "reps_only", "bodyweight_weighted", "bodyweight_assisted"]);
const isCompound = (t: ExerciseTemplate) => t.secondary_muscle_groups.length > 0;

export interface Prescription {
  templateId: string;
  title: string;
  equipment: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetReps: number;
  /** Load as Hevy logs it (dumbbells: the pair combined). null = bodyweight / reps only. */
  loggedWeightKg: number | null;
  displayWeight: string;
  action: "increase" | "hold" | "reduce" | "deload" | "new";
  rationale: string;
  last: string | null;
  sourceIds: string[];
}

export interface WorkoutPlan {
  session: SessionKind;
  deload: boolean;
  exercises: Prescription[];
  notes: string[];
}

function increment(t: ExerciseTemplate): number {
  if (t.equipment === "dumbbell") return 4; // 2 kg per hand, logged as the pair
  if (t.equipment === "kettlebell") return 4;
  return 2.5;
}

function roundTo(w: number, step: number): number {
  return Math.max(step, Math.round(w / step) * step);
}

export function formatWeight(t: ExerciseTemplate, logged: number | null): string {
  if (logged === null) return t.type === "reps_only" ? "Bodyweight" : "-";
  if (t.type === "bodyweight_weighted") return logged > 0 ? `BW + ${logged} kg` : "Bodyweight";
  if (t.equipment === "dumbbell") return `${logged / 2} kg each (log ${logged})`;
  return `${logged} kg`;
}

function describe(sets: HevySet[]): string {
  return sets
    .map((s) => (s.weight_kg ? `${s.weight_kg}×${s.reps ?? "?"}` : `${s.reps ?? "?"}`) + (s.rpe ? ` @${s.rpe}` : ""))
    .join(", ");
}

/** Double progression from the last performance of an exercise. */
export function prescribe(
  t: ExerciseTemplate,
  history: Performance[] | undefined,
  slot: Slot,
  deload: boolean,
): Prescription {
  const compound = isCompound(t);
  const [repMin, repMax] = compound ? [6, 10] : [10, 15];
  const base = {
    templateId: t.id,
    title: t.title,
    equipment: t.equipment,
    repMin,
    repMax,
    sourceIds: ["schoenfeld2021reps", "acsm2009"],
  };
  const sets = deload ? Math.max(1, Math.ceil(slot.sets / 2)) : slot.sets;
  const last = history?.[0];

  if (!last) {
    return {
      ...base,
      sets,
      targetReps: repMin,
      loggedWeightKg: null,
      displayWeight: "Pick a weight you can do for " + repMax + " reps",
      action: "new",
      rationale: "No history for this exercise yet. Start light and log it.",
      last: null,
    };
  }

  const lastStr = `${last.day}: ${describe(last.sets)}`;

  // Reps-only movements: progress reps.
  if (t.type === "reps_only" || !last.sets.some((s) => s.weight_kg)) {
    const best = Math.max(...last.sets.map((s) => s.reps ?? 0));
    return {
      ...base,
      sets,
      targetReps: deload ? Math.max(1, best - 2) : best + 1,
      loggedWeightKg: null,
      displayWeight: formatWeight(t, null),
      action: deload ? "deload" : "increase",
      rationale: deload ? "Deload: stop 2-3 reps short of your best." : `Beat last time's best of ${best} reps by one.`,
      last: lastStr,
    };
  }

  // Working weight = heaviest load used for the most sets last session.
  const weights = last.sets.map((s) => s.weight_kg ?? 0);
  const work = Math.max(...weights);
  const atWork = last.sets.filter((s) => s.weight_kg === work);
  const minReps = Math.min(...atWork.map((s) => s.reps ?? 0));
  const maxReps = Math.max(...atWork.map((s) => s.reps ?? 0));
  const maxRpe = Math.max(0, ...atWork.map((s) => s.rpe ?? 0));
  const step = increment(t);

  if (deload) {
    const w = roundTo(work * 0.9, step);
    return {
      ...base,
      sets,
      targetReps: repMin,
      loggedWeightKg: w,
      displayWeight: formatWeight(t, w),
      action: "deload",
      rationale: `Deload week: half the sets at ~90% of your ${formatWeight(t, work)}. Stop well short of failure.`,
      last: lastStr,
      sourceIds: [...base.sourceIds, "bell2023deload"],
    };
  }

  // Stalled or declining over the last three sessions → back off ~10%.
  const recent = (history ?? []).slice(0, 3);
  const declining =
    recent.length === 3 &&
    bestE1rm(recent[0]) < bestE1rm(recent[1]) &&
    bestE1rm(recent[1]) < bestE1rm(recent[2]) &&
    daysBetween(recent[2].day, recent[0].day) <= 42;
  if (declining) {
    const w = roundTo(work * 0.9, step);
    return {
      ...base,
      sets,
      targetReps: repMin + 2,
      loggedWeightKg: w,
      displayWeight: formatWeight(t, w),
      action: "reduce",
      rationale: "Performance fell two sessions in a row. Drop ~10% and build back up with clean reps.",
      last: lastStr,
    };
  }

  // Reps well below the range → pick the load that fits the bottom of the range.
  if (maxReps < repMin) {
    const w = roundTo(e1rm(work, maxReps) / (1 + repMin / 30), step);
    return {
      ...base,
      sets,
      targetReps: repMin,
      loggedWeightKg: Math.min(w, work),
      displayWeight: formatWeight(t, Math.min(w, work)),
      action: w < work ? "reduce" : "hold",
      rationale: `Last time topped out at ${maxReps} reps, below the ${repMin}-${repMax} range. Use the load that gets you ${repMin} reps.`,
      last: lastStr,
    };
  }

  // Top of range on every set (and not grinding, if RPE logged) → add load.
  const rpeOk = maxRpe === 0 || maxRpe <= 9;
  if (minReps >= repMax && rpeOk) {
    const w = work + step;
    return {
      ...base,
      sets,
      targetReps: repMin,
      loggedWeightKg: w,
      displayWeight: formatWeight(t, w),
      action: "increase",
      rationale: `Hit ${repMax}+ reps on every set${maxRpe ? ` at RPE ≤ ${maxRpe}` : ""}. Add ${t.equipment === "dumbbell" ? "2 kg per hand" : `${step} kg`}.`,
      last: lastStr,
      sourceIds: maxRpe ? [...base.sourceIds, "helms2016rpe"] : base.sourceIds,
    };
  }

  return {
    ...base,
    sets,
    targetReps: Math.min(repMax, maxReps + 1),
    loggedWeightKg: work,
    displayWeight: formatWeight(t, work),
    action: "hold",
    rationale:
      minReps >= repMax && !rpeOk
        ? `Reps are there but RPE ${maxRpe} was a grind. Same weight, make it smoother.`
        : `Same weight. Aim for ${Math.min(repMax, maxReps + 1)} reps; when every set hits ${repMax}, the load goes up.`,
    last: lastStr,
    sourceIds: maxRpe ? [...base.sourceIds, "helms2016rpe"] : base.sourceIds,
  };
}

/** Rank exercise templates for a slot by how often they were used in the last ~120 days. */
function rankForSlot(
  slot: Slot,
  templates: TemplateMap,
  perf: Map<string, Performance[]>,
  today: string,
): ExerciseTemplate[] {
  const scored: { t: ExerciseTemplate; recent: number; total: number; kindMatch: number }[] = [];
  for (const [id, list] of perf) {
    const t = templates.get(id);
    if (!t || !STRENGTH_TYPES.has(t.type) || !slot.muscles.includes(t.primary_muscle_group)) continue;
    const recent = list.filter((p) => daysBetween(p.day, today) <= 120).length;
    const kindMatch =
      slot.kind === "any" || (slot.kind === "compound") === isCompound(t) ? 1 : 0;
    scored.push({ t, recent, total: list.length, kindMatch });
  }
  scored.sort((a, b) => b.kindMatch - a.kindMatch || b.recent - a.recent || b.total - a.total);
  return scored.map((s) => s.t);
}

export function buildStrengthWorkout(
  session: "upper_a" | "upper_b" | "legs",
  templates: TemplateMap,
  perf: Map<string, Performance[]>,
  today: string,
  deload: boolean,
): WorkoutPlan {
  const slots = session === "legs" ? LEG_SLOTS : UPPER_SLOTS;
  const variant = session === "upper_b" ? 1 : 0;
  const chosen = new Set<string>();
  const exercises: Prescription[] = [];
  const notes: string[] = [];

  if (!perf.size) {
    notes.push("No workout history synced yet. Sync Hevy to get exercises and weights from your own logs.");
    return { session, deload, exercises, notes };
  }
  for (const slot of slots) {
    const ranked = rankForSlot(slot, templates, perf, today).filter((t) => !chosen.has(t.id));
    const t = ranked[variant] ?? ranked[0];
    if (!t) {
      notes.push(`No ${slot.muscles.join("/")} exercise in your history. Add one you like (e.g. from Hevy's library).`);
      continue;
    }
    chosen.add(t.id);
    exercises.push(prescribe(t, perf.get(t.id), slot, deload));
  }
  if (session === "legs") notes.push("Legs are on maintenance: few sets, close to failure, then go home.");
  if (deload) notes.push("Deload week: lighter and fewer sets, no grinding. This clears fatigue so progress restarts.");
  return { session, deload, exercises, notes };
}

export interface CircuitItem {
  title: string;
  prescription: string;
}

/** Circuit from the conditioning work you already do. */
export function buildCircuit(
  templates: TemplateMap,
  perf: Map<string, Performance[]>,
  today: string,
  deload: boolean,
): { items: CircuitItem[]; rounds: number; notes: string[] } {
  const cond: { t: ExerciseTemplate; n: number; last: Performance }[] = [];
  for (const [id, list] of perf) {
    const t = templates.get(id);
    if (!t) continue;
    const isCond = ["cardio", "full_body"].includes(t.primary_muscle_group) || t.type === "short_distance_weight";
    if (!isCond) continue;
    const n = list.filter((p) => daysBetween(p.day, today) <= 180).length;
    if (n) cond.push({ t, n, last: list[0] });
  }
  cond.sort((a, b) => b.n - a.n);
  const cardio = cond.filter((c) => c.t.primary_muscle_group === "cardio").slice(0, 1);
  const strength = cond.filter((c) => c.t.primary_muscle_group !== "cardio").slice(0, 4);

  const items: CircuitItem[] = strength.map(({ t, last }) => {
    const s = last.sets[0];
    let p = "";
    if (t.type === "short_distance_weight") p = `${s.weight_kg ?? "?"} kg × ${s.distance_meters ?? 40} m`;
    else if (t.type === "duration") p = `${s.duration_seconds ?? 45} s`;
    else p = `${s.weight_kg ? s.weight_kg + " kg × " : ""}${s.reps ?? 10} reps`;
    return { title: t.title, prescription: p };
  });
  const rounds = deload ? 2 : 4;
  const notes = [
    `${rounds} rounds, moving straight between stations, 60-90 s rest between rounds.`,
    "Aim to spend 15+ minutes with your heart rate above ~70% of max.",
  ];
  if (cardio[0]) {
    const s = cardio[0].last.sets[0];
    const mins = Math.round((s.duration_seconds ?? 900) / 60);
    items.push({ title: cardio[0].t.title, prescription: `Finish with ${Math.max(10, Math.min(mins, 20))} min steady` });
  }
  if (!items.length) notes.unshift("No conditioning history yet. Try: KB swings ×15, farmer's walk 40 m, air bike 60 s, then 15 min treadmill.");
  return { items, rounds, notes };
}
