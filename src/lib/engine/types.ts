// Shapes mirror the Hevy public API (v1) where they come from it.

export interface ExerciseTemplate {
  id: string;
  title: string;
  type: string; // weight_reps | reps_only | duration | distance_duration | bodyweight_weighted | ...
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string; // barbell | dumbbell | machine | kettlebell | none | other | ...
}

export interface HevySet {
  index?: number;
  type: string; // normal | warmup | failure | dropset
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
}

export interface HevyExercise {
  index?: number;
  title: string;
  exercise_template_id: string;
  sets: HevySet[];
}

export interface HevyWorkout {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  exercises: HevyExercise[];
}

export interface Profile {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number; // fallback when there is no weigh-in
  timezone: string; // IANA, e.g. "Europe/London"
  phaseStart: string | null; // YYYY-MM-DD, start of Phase 1 (deload week)
  calorieAdjust: number; // kcal, from weigh-in trend recalibration
  lastRecalibration: string | null; // YYYY-MM-DD
  foods: string[];
}

export interface CheckIn {
  date: string; // YYYY-MM-DD
  sleep: number; // 1-5
  soreness: number; // 1-5 (5 = very sore)
  energy: number; // 1-5
}

export interface WeighIn {
  date: string;
  weightKg: number;
}

export interface HealthDay {
  date: string;
  steps: number | null;
  activeEnergyKcal: number | null;
}

export interface HrSample {
  ts: string; // ISO timestamp
  bpm: number;
}

export type Category = "upper" | "legs" | "circuit";
export type SessionKind = "upper_a" | "upper_b" | "legs" | "circuit";
