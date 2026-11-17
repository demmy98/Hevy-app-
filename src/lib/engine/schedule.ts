import type { Category, CheckIn, SessionKind } from "./types";
import type { ClassifiedWorkout } from "./history";
import { addDays, daysBetween, weekStart } from "./time";

export const WEEKLY_TARGET: Record<Category, number> = { upper: 2, legs: 1, circuit: 1 };
/** Minimum full days between hard sessions for the same muscles. */
export const MIN_GAP_DAYS: Record<Category, number> = { upper: 2, legs: 3, circuit: 1 };
export const MAX_CONSECUTIVE_DAYS = 3;

export interface Decision {
  action: "train" | "rest" | "done";
  session: SessionKind | null;
  category: Category | null;
  reasons: string[];
  sourceIds: string[];
  readiness: number | null;
  week: { done: Record<Category, number>; target: Record<Category, number>; daysLeft: number };
}

export function readinessScore(c: CheckIn | null): number | null {
  if (!c) return null;
  return Math.round(((c.sleep + (6 - c.soreness) + c.energy) / 3) * 10) / 10;
}

const LABEL: Record<Category, string> = { upper: "Upper", legs: "Legs", circuit: "Circuit" };

function upperVariant(doneUpperThisWeek: number): SessionKind {
  return doneUpperThisWeek % 2 === 0 ? "upper_a" : "upper_b";
}

/** Decide what to do today. */
export function decideToday(classified: ClassifiedWorkout[], today: string, checkIn: CheckIn | null): Decision {
  const ws = weekStart(today);
  const done: Record<Category, number> = { upper: 0, legs: 0, circuit: 0 };
  for (const c of classified) if (c.day >= ws && c.day <= today) done[c.category]++;
  const daysLeft = daysBetween(today, addDays(ws, 6)) + 1;
  const readiness = readinessScore(checkIn);
  const base = { readiness, week: { done, target: WEEKLY_TARGET, daysLeft } };

  // 1. Already trained today
  const todays = classified.filter((c) => c.day === today);
  if (todays.length) {
    const cat = todays[todays.length - 1].category;
    const session = cat === "upper" ? upperVariant(done.upper - 1) : cat;
    return {
      ...base,
      action: "done",
      session,
      category: cat,
      reasons: [`Already logged ${LABEL[cat]} today. Focus on food and recovery.`],
      sourceIds: [],
    };
  }

  // 2. Consecutive-day cap
  const trainedDays = new Set(classified.map((c) => c.day));
  let streak = 0;
  for (let d = addDays(today, -1); trainedDays.has(d); d = addDays(d, -1)) streak++;
  if (streak >= MAX_CONSECUTIVE_DAYS) {
    return {
      ...base,
      action: "rest",
      session: null,
      category: null,
      reasons: [`You've trained ${streak} days in a row. Take a rest day so you recover.`],
      sourceIds: ["acsm2009"],
    };
  }

  // 3. Weekly target
  const due: Category[] = (Object.keys(WEEKLY_TARGET) as Category[]).filter((k) => done[k] < WEEKLY_TARGET[k]);
  const totalDue = due.reduce((n, k) => n + (WEEKLY_TARGET[k] - done[k]), 0);
  if (!due.length) {
    return {
      ...base,
      action: "rest",
      session: null,
      category: null,
      reasons: ["This week's target (2 upper, 1 legs, 1 circuit) is already done. Rest, or do an easy optional extra."],
      sourceIds: ["schoenfeld2016freq"],
    };
  }

  // 4. Recovery per category
  const lastDay: Partial<Record<Category, string>> = {};
  for (const c of classified) if (c.day < today) lastDay[c.category] = c.day;
  const recovered = (k: Category) => {
    const last = lastDay[k];
    return !last || daysBetween(last, today) >= MIN_GAP_DAYS[k];
  };
  let candidates = due.filter(recovered);
  const reasons: string[] = [];
  const sourceIds = new Set<string>(["acsm2009", "schoenfeld2016freq"]);

  // 5. Readiness gate
  if (readiness !== null) {
    sourceIds.add("greig2020autoreg");
    if (readiness <= 2) {
      return {
        ...base,
        action: "rest",
        session: null,
        category: null,
        reasons: [`Readiness ${readiness}/5 is low (sleep, soreness, energy). Rest today. A short walk is fine.`],
        sourceIds: [...sourceIds],
      };
    }
    if (readiness <= 2.5) {
      candidates = candidates.filter((k) => k === "circuit");
      reasons.push(`Readiness ${readiness}/5 is moderate, so only a conditioning session is on the table.`);
    }
    if (checkIn && checkIn.soreness >= 4 && candidates.includes("circuit")) {
      candidates = ["circuit"];
      reasons.push("You're quite sore, so today is the circuit rather than heavy lifting.");
    }
  }

  if (!candidates.length) {
    const waits = due
      .filter((k) => !recovered(k))
      .map((k) => `${LABEL[k]} was trained ${daysBetween(lastDay[k]!, today)} day(s) ago`);
    return {
      ...base,
      action: "rest",
      session: null,
      category: null,
      reasons: [...reasons, waits.length ? `Still recovering: ${waits.join("; ")}.` : "Rest day."],
      sourceIds: [...sourceIds],
    };
  }

  // 6. Priority: upper (growth focus) > legs (maintenance) > circuit
  const order: Category[] = ["upper", "legs", "circuit"];
  candidates.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const pick = candidates[0];
  const session = pick === "upper" ? upperVariant(done.upper) : pick;

  const since = lastDay[pick] ? `last ${LABEL[pick].toLowerCase()} session ${daysBetween(lastDay[pick]!, today)} days ago` : "no recent session";
  reasons.unshift(`${LABEL[pick]}: ${since}; ${WEEKLY_TARGET[pick] - done[pick]} of ${WEEKLY_TARGET[pick]} still due this week.`);
  if (readiness !== null && readiness > 2.5) reasons.push(`Readiness ${readiness}/5. Good to go.`);
  if (totalDue >= daysLeft) reasons.push(`${totalDue} sessions due and ${daysLeft} day(s) left in the week. Today counts.`);
  else reasons.push(`${totalDue} sessions due with ${daysLeft} days left, so you could also rest today and still make the week.`);
  if (pick === "legs") sourceIds.add("bickel2011");
  if (pick === "circuit") sourceIds.add("who2020");

  return { ...base, action: "train", session, category: pick, reasons, sourceIds: [...sourceIds] };
}
