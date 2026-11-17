import type { Category, HealthDay, HrSample, Profile, WeighIn } from "./types";
import { daysBetween } from "./time";

export type DayType = "rest" | "lift" | "circuit";

export const SURPLUS_KCAL = 250;
const MET = { lift: 5, circuit: 8 };
const SESSION_HOURS = { lift: 80 / 60, circuit: 45 / 60 };
const STEP_BASELINE = 5000;
const STEP_ADJ_CAP = 250;
export const PROTEIN_G_PER_KG = 1.8;
const FAT_SHARE = 0.25;
const FAT_MIN_G_PER_KG = 0.6;

export function dayTypeFor(category: Category | null): DayType {
  if (!category) return "rest";
  return category === "circuit" ? "circuit" : "lift";
}

export function bmr(p: Pick<Profile, "sex" | "age" | "heightCm">, kg: number): number {
  const base = 10 * kg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

export function currentWeight(profile: Profile, weighIns: WeighIn[]): number {
  if (!weighIns.length) return profile.weightKg;
  return [...weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.weightKg;
}

export function avgSteps(health: HealthDay[], today: string): number | null {
  const recent = health.filter((h) => h.steps !== null && h.date < today && daysBetween(h.date, today) <= 7);
  if (!recent.length) return null;
  return Math.round(recent.reduce((n, h) => n + (h.steps ?? 0), 0) / recent.length);
}

export interface NutritionTargets {
  dayType: DayType;
  weightKg: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  breakdown: { label: string; kcal: number }[];
  sourceIds: string[];
}

export function nutritionTargets(
  profile: Profile,
  dayType: DayType,
  weightKg: number,
  stepsAvg: number | null,
): NutritionTargets {
  const b = bmr(profile, weightKg);
  const breakdown = [
    { label: "Resting (Mifflin-St Jeor)", kcal: Math.round(b) },
    { label: "Desk-job daily activity (×1.2)", kcal: Math.round(b * 0.2) },
  ];
  if (dayType !== "rest") {
    const cost = (MET[dayType] - 1) * weightKg * SESSION_HOURS[dayType];
    breakdown.push({ label: dayType === "lift" ? "Lifting session (~80 min)" : "Circuit (~45 min)", kcal: Math.round(cost) });
  }
  if (stepsAvg !== null) {
    const adj = Math.max(-STEP_ADJ_CAP, Math.min(STEP_ADJ_CAP, (stepsAvg - STEP_BASELINE) * 0.0005 * weightKg));
    breakdown.push({ label: `Steps (7-day avg ${stepsAvg.toLocaleString("en-GB")})`, kcal: Math.round(adj) });
  }
  breakdown.push({ label: "Lean-gain surplus", kcal: SURPLUS_KCAL });
  if (profile.calorieAdjust) breakdown.push({ label: "Weigh-in trend adjustment", kcal: profile.calorieAdjust });

  const kcal = Math.round(breakdown.reduce((n, x) => n + x.kcal, 0) / 10) * 10;
  const proteinG = Math.round(PROTEIN_G_PER_KG * weightKg);
  const fatG = Math.round(Math.max((kcal * FAT_SHARE) / 9, FAT_MIN_G_PER_KG * weightKg));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return {
    dayType,
    weightKg,
    kcal,
    proteinG,
    carbsG,
    fatG,
    breakdown,
    sourceIds: ["mifflin1990", "ainsworth2011", "iraki2019", "morton2018protein", "issn2017protein"],
  };
}

/** Least-squares slope of weight over time, kg/week. */
export function weightTrendPerWeek(weighIns: WeighIn[]): number | null {
  if (weighIns.length < 3) return null;
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const x = sorted.map((w) => daysBetween(sorted[0].date, w.date));
  if (x.at(-1)! < 14) return null;
  const y = sorted.map((w) => w.weightKg);
  const mx = x.reduce((a, b) => a + b) / x.length;
  const my = y.reduce((a, b) => a + b) / y.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  return den ? (num / den) * 7 : null;
}

export const TARGET_GAIN = { min: 0.2, max: 0.4 }; // kg/week (~0.25-0.5% of 80 kg)

/** Weekly recalibration: nudge the surplus ±150 kcal when the trend is off target. */
export function recalibrate(
  weighIns: WeighIn[],
  currentAdjust: number,
  lastRecalibration: string | null,
  today: string,
): { adjust: number; changed: boolean; trend: number | null; message: string } {
  const recent = weighIns.filter((w) => daysBetween(w.date, today) <= 42);
  const trend = weightTrendPerWeek(recent);
  if (trend === null) return { adjust: currentAdjust, changed: false, trend, message: "Need 3+ weigh-ins over 2+ weeks to judge the trend." };
  if (lastRecalibration && daysBetween(lastRecalibration, today) < 7)
    return { adjust: currentAdjust, changed: false, trend, message: "Already adjusted this week." };
  const t = Math.round(trend * 100) / 100;
  if (trend < TARGET_GAIN.min) {
    const adjust = Math.min(500, currentAdjust + 150);
    return { adjust, changed: true, trend, message: `Gaining ${t} kg/wk (target 0.2-0.4). +150 kcal/day.` };
  }
  if (trend > TARGET_GAIN.max) {
    const adjust = Math.max(-500, currentAdjust - 150);
    return { adjust, changed: true, trend, message: `Gaining ${t} kg/wk, faster than 0.2-0.4. −150 kcal/day.` };
  }
  return { adjust: currentAdjust, changed: false, trend, message: `Gaining ${t} kg/wk. On target, no change.` };
}

export function hrThreshold(age: number): number {
  return Math.round((208 - 0.7 * age) * 0.7);
}

/** Minutes with HR at or above threshold between start and end (sample gaps capped at 5 min). */
export function minutesAbove(samples: HrSample[], start: string, end: string, threshold: number): number | null {
  const s = +new Date(start);
  const e = +new Date(end);
  const inWin = samples
    .map((x) => ({ t: +new Date(x.ts), bpm: x.bpm }))
    .filter((x) => x.t >= s && x.t <= e)
    .sort((a, b) => a.t - b.t);
  if (inWin.length < 2) return null;
  let ms = 0;
  for (let i = 0; i < inWin.length - 1; i++) {
    if (inWin[i].bpm >= threshold) ms += Math.min(inWin[i + 1].t - inWin[i].t, 5 * 60000);
  }
  return Math.round(ms / 60000);
}
