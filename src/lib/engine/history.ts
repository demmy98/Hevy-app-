import type { Category, ExerciseTemplate, HevySet, HevyWorkout } from "./types";
import { localDay } from "./time";

export const UPPER = new Set(["chest", "lats", "upper_back", "shoulders", "biceps", "triceps", "forearms", "traps", "neck"]);
export const LOWER = new Set(["quadriceps", "hamstrings", "glutes", "calves", "abductors", "adductors"]);
export const CONDITIONING = new Set(["cardio", "full_body"]);

/** Strength set types whose sets count towards hypertrophy volume. */
const STRENGTH_TYPES = new Set(["weight_reps", "reps_only", "bodyweight_weighted", "bodyweight_assisted"]);

export const isWorkingSet = (s: HevySet) => s.type !== "warmup";

export type TemplateMap = Map<string, ExerciseTemplate>;

export function toTemplateMap(templates: ExerciseTemplate[]): TemplateMap {
  return new Map(templates.map((t) => [t.id, t]));
}

/** Classify a logged workout as upper / legs / circuit by where its working sets went. */
export function classifyWorkout(w: HevyWorkout, templates: TemplateMap): Category {
  let upper = 0;
  let lower = 0;
  let cond = 0;
  for (const e of w.exercises) {
    const t = templates.get(e.exercise_template_id);
    if (!t) continue;
    const n = e.sets.filter(isWorkingSet).length;
    const m = t.primary_muscle_group;
    // Cardio, full-body moves, carries and timed work all count as conditioning.
    if (CONDITIONING.has(m) || !STRENGTH_TYPES.has(t.type)) cond += n;
    else if (UPPER.has(m)) upper += n;
    else if (LOWER.has(m)) lower += n;
  }
  const total = upper + lower + cond;
  if (total === 0) return "circuit";
  if (cond / total >= 0.4) return "circuit";
  return lower > upper ? "legs" : "upper";
}

export interface ClassifiedWorkout {
  workout: HevyWorkout;
  day: string;
  category: Category;
}

export function classifyAll(workouts: HevyWorkout[], templates: TemplateMap, tz: string): ClassifiedWorkout[] {
  return workouts
    .map((w) => ({ workout: w, day: localDay(w.start_time, tz), category: classifyWorkout(w, templates) }))
    .sort((a, b) => a.workout.start_time.localeCompare(b.workout.start_time));
}

/** Hard sets per muscle (primary = 1, each secondary = 0.5) for workouts in [fromDay, toDay]. */
export function muscleVolume(
  classified: ClassifiedWorkout[],
  templates: TemplateMap,
  fromDay: string,
  toDay: string,
): Record<string, number> {
  const vol: Record<string, number> = {};
  for (const c of classified) {
    if (c.day < fromDay || c.day > toDay) continue;
    for (const e of c.workout.exercises) {
      const t = templates.get(e.exercise_template_id);
      if (!t || !STRENGTH_TYPES.has(t.type)) continue;
      const n = e.sets.filter(isWorkingSet).length;
      vol[t.primary_muscle_group] = (vol[t.primary_muscle_group] ?? 0) + n;
      for (const s of t.secondary_muscle_groups) vol[s] = (vol[s] ?? 0) + n * 0.5;
    }
  }
  return vol;
}

export interface Performance {
  day: string;
  sets: HevySet[]; // working sets only
}

/** Per exercise template: list of performances, newest first. */
export function performancesByTemplate(classified: ClassifiedWorkout[]): Map<string, Performance[]> {
  const out = new Map<string, Performance[]>();
  for (let i = classified.length - 1; i >= 0; i--) {
    const c = classified[i];
    for (const e of c.workout.exercises) {
      const sets = e.sets.filter(isWorkingSet);
      if (!sets.length) continue;
      const list = out.get(e.exercise_template_id) ?? [];
      list.push({ day: c.day, sets });
      out.set(e.exercise_template_id, list);
    }
  }
  return out;
}

/** Epley estimated 1RM. */
export const e1rm = (w: number, r: number) => w * (1 + r / 30);

export function bestE1rm(p: Performance): number {
  let best = 0;
  for (const s of p.sets) {
    if (s.weight_kg && s.reps) best = Math.max(best, e1rm(s.weight_kg, s.reps));
  }
  return best;
}
