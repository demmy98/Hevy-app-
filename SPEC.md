# Hevy Coach: Project Spec

A personal web app that reads my Hevy workout history and tells me, each day:
**whether to train, what to train, and what to eat**, using rules taken from
published research, with the source shown next to every recommendation.

This spec came out of a requirements interview ("grill-me" session) on 2026-11-17.

---

## 1. Scope

| Decision | Choice |
|---|---|
| Users | Just me for now. Data model keyed by user so friends can be added later. |
| Interface | Mobile-friendly web page, password login, hosted on a free tier. |
| "Brain" | Deterministic, research-backed rules do every number. Claude only writes the readable plan and meal ideas, on demand ("Generate today's plan" button). |
| Evidence | Research and position stands first. Every rule carries a citation, shown in the UI. No influencer opinion without studies behind it. |

## 2. Inputs

| Source | What | How |
|---|---|---|
| Hevy API (`api.hevyapp.com`, Pro) | Full workout history, exercise templates (muscle groups, equipment) | Read-only, `api-key` header. Synced on demand. |
| Daily check-in (10 s) | Sleep, soreness, energy, each 1–5 | Form on the Today page |
| Weekly weigh-in | Body weight, kg | Prompted once a week |
| Apple Health via a free iOS Shortcut | Steps, active energy, heart-rate samples (from AirPods) | Shortcut POSTs JSON to `/api/health` with a bearer token. See `docs/apple-shortcut.md`. |

**Profile:** male, 27, 174 cm, 80 kg, desk job. Full commercial gym, no injuries, no dietary
restrictions. Mostly cooks: rice, pork, eggs, vegetables.

**Logging conventions:**
- Dumbbell exercises are logged as the **pair combined** (84 kg = two 42 kg dumbbells). The app shows "42 kg each".
- Turn on RPE in Hevy (Settings → Workouts) and log it on the first 2–3 lifts.

## 3. Training rules

### Weekly target (4 visits)

| Session | Per week | Focus |
|---|---|---|
| Upper A / Upper B | 2 | **Priority.** Chest, back, shoulders, arms |
| Legs | 1 | **Maintenance**, about 6–9 hard sets for quads, hamstrings and glutes combined |
| Circuit | 1 | General conditioning (treadmill, air bike, KB swings, Turkish get-ups, farmer's walks), mixing cardio and strength. No leg emphasis. |

### Picking today's session

1. Already trained today → done.
2. Trained 3 days in a row → **rest**.
3. Check-in readiness ≤ 2/5 → **rest** (≤ 2.5 → circuit only, if one is due).
4. Week's target already met → **rest** (an optional extra is allowed).
5. Of the sessions still due this week, the candidates are those whose muscles have recovered:
   upper needs ≥ 48 h since the last upper session, legs ≥ 72 h since the last legs session.
6. Pick by priority: upper (growth focus) > legs (maintenance) > circuit. If the number of
   sessions still due ≥ days left in the week, the app says training is needed today.

### Volume
- Count hard (non-warm-up) sets per muscle over the rolling 7 days. Primary muscle = 1 set, secondary muscle = 0.5.
- Targets: upper muscles 10–16 sets a week; quads, hamstrings and glutes 3–6 each (maintenance); abs capped at 8.

### Phase 1: break the plateau
- **Week 1: deload.** Half the sets, about 90% of the load (Bell et al. 2023).
- **After that: progression.** Rebalance volume: fewer ab sets, more shoulder and triceps work.

### Workout builder
- Upper slots: chest ×2, back ×2 (lats + upper back), shoulders ×2, biceps, triceps.
  Legs: quads ×2, hamstrings ×2, calves. Each slot is filled with the **exercise I use most** for that muscle.
  Upper B uses my second choice where I have one.
- Rep ranges: compounds 6–10, isolations 10–15 (Schoenfeld et al. 2021).
- **Double progression:**
  - Hit the top of the range on every working set, with RPE ≤ 9 if logged → add load.
    Increments: +2.5 kg barbell or machine; +4 kg combined (2 kg each) for dumbbells.
  - Otherwise keep the weight and aim for +1 rep.
  - The last two sessions both went down → drop the load about 10%.

### Circuit check
Heart-rate samples recorded during the circuit's Hevy time window are compared with 70% of
age-predicted max HR (Tanaka: 208 − 0.7 × age, about 189 → threshold about 132 bpm).
Goal: at least 15 minutes above the threshold.

## 4. Nutrition rules

- BMR from Mifflin–St Jeor (male): `10·kg + 6.25·cm − 5·age + 5`.
- Daily needs: `BMR × 1.2` (desk job) + session cost + step adjustment.
  - Session cost: `(MET − 1) × kg × hours`. Lifting MET 5 for about 80 min; circuit MET 8 for about 45 min (Ainsworth Compendium).
  - Step adjustment: `(7-day avg steps − 5,000) × 0.0005 × kg` kcal, capped at ±250.
- Lean-gain surplus: +250 kcal a day. The weekly weigh-in trend (≥ 3 weigh-ins over ≥ 14 days)
  aims for +0.2–0.4 kg a week (0.25–0.5% of bodyweight, Iraki et al. 2019) and moves the
  surplus by ±150 kcal when the trend falls outside that range.
- Macros:
  - **Protein 1.8 g/kg every day** (range 1.6–2.2; Morton et al. 2018, ISSN 2017).
  - Fat 25% of calories, at least 0.6 g/kg.
  - Carbs fill the rest, so they rise and fall with activity.
- Expected starting targets: rest day ~2,350 kcal; lifting or circuit day ~2,750 kcal.
- Meals: 3 ideas a day built from rice, pork, eggs and vegetables, with gram amounts that hit the targets (written by Claude).

## 5. "Today" screen

1. **Train or rest**, which session, and why (e.g. "Upper A: last upper 3 days ago, readiness 4/5").
2. **Workout:** exercises, sets, target weight and reps, using my own exercise history.
3. **Food:** calories and protein/carbs/fat for the day type, plus meal ideas.
4. **Sources:** every rule that fired, linked.

Also: check-in form, weigh-in form, "Sync Hevy" button, "Generate today's plan" button.

## 6. Tech

| Choice | Detail |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Database | libSQL: a local file in dev, Turso free tier in production (works on Vercel) |
| AI | Anthropic SDK, `claude-opus-5-5`, server-side refusal fallback, only when the button is pressed |
| Auth | One password (env `APP_PASSWORD`) → signed HTTP-only cookie. Apple Shortcut uses a separate `HEALTH_INGEST_TOKEN`. |
| Tests | Vitest on the rules engine (pure functions, no network) |
| Hosting | Vercel free tier |

## 7. Out of scope for now
- Multiple users and friend accounts (the data model allows them later).
- Food logging or a food-tracker integration.
- A native iOS app (the Apple Shortcut covers Health data).
- Writing to Hevy (read-only).
