import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { DailyPlan } from "./engine/plan";
import type { Profile } from "./engine/types";

const MODEL = "claude-opus-5-5";

const SYSTEM = `You write a short daily coaching note for one person, based on a plan produced by a rules engine.

Hard rules:
- Never change, round differently, or contradict any number in the plan (sessions, sets, reps, weights, calories, macros). Restate them only if useful.
- Ground every claim in the plan's "sources" list. When you make a training or nutrition claim, cite it like [Morton 2018] using the source's "short" name. Do not cite anything that isn't in the list, and do not invent studies, statistics or advice from influencers.
- If something isn't covered by the plan or its sources, say it's outside what the app tracks rather than guessing.
- Dumbbell weights are logged in Hevy as the pair combined; the plan already shows per-hand numbers. Keep that framing.

Write in plain, direct language, as Markdown with exactly these sections:
## Today
2-4 sentences: what to do and why, from the plan's decision reasons and phase.
## Meals
Exactly 3 meals (plus 1 optional snack only if needed to hit targets) using mainly the person's staple foods. For each: name, ingredients with gram amounts (cooked rice, raw meat weights stated), and approximate kcal / protein / carbs / fat. The day's total must land within ~5% of the calorie target and at or above the protein target; finish with a one-line total.
## Tips
1-3 bullet points, each tied to a cited source or to a warning in the plan.`;

export async function writeDailyNote(plan: DailyPlan, profile: Profile): Promise<string> {
  const client = new Anthropic();
  const payload = {
    date: plan.date,
    phase: plan.phase,
    decision: { action: plan.decision.action, session: plan.decision.session, reasons: plan.decision.reasons, readiness: plan.decision.readiness },
    workout: plan.workout?.exercises.map((e) => ({ exercise: e.title, sets: e.sets, reps: e.targetReps, weight: e.displayWeight, why: e.rationale })),
    circuit: plan.circuit,
    nutrition: { dayType: plan.nutrition.dayType, kcal: plan.nutrition.kcal, proteinG: plan.nutrition.proteinG, carbsG: plan.nutrition.carbsG, fatG: plan.nutrition.fatG },
    warnings: plan.warnings,
    stapleFoods: profile.foods,
    dietaryRestrictions: "none",
    sources: plan.sources.map((s) => ({ short: s.short, claim: s.claim })),
  };

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Today's plan (JSON):\n${JSON.stringify(payload, null, 2)}` }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to write today's note. The plan above is still valid.");
  }
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  if (!text) throw new Error("Claude returned an empty note.");
  return text;
}
