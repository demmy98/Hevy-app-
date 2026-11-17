# Hevy Coach

A personal web app that reads your [Hevy](https://hevy.com) workout history and tells you each day
**whether to train, what to train, and what to eat**. Every number comes from research-based rules,
and each recommendation lists its sources. See [`SPEC.md`](SPEC.md) for the full design.

- **Today screen:** train or rest (with reasons), the workout (your own exercises, with progression),
  food targets (calories, protein, carbs, fat), Claude-written meal ideas, and sources.
- **Inputs:** the Hevy API, a 10-second daily check-in, a weekly weigh-in, and Apple Health via a free iOS Shortcut.
- **How it works:** a deterministic rules engine (`src/lib/engine/`, unit-tested) does all the maths. Claude
  (`claude-opus-5-5`) only writes the readable note and meals, and only when you press the button.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm test                     # rules-engine tests
```

| Variable | What |
|---|---|
| `HEVY_API_KEY` | Hevy Pro key from https://hevy.com/settings?developer |
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com. Used only by "Generate today's plan" |
| `APP_PASSWORD` | Your login password |
| `SESSION_SECRET` | 32+ random chars (`openssl rand -hex 32`) |
| `HEALTH_INGEST_TOKEN` | Random token for the Apple Shortcut (`openssl rand -hex 24`) |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Leave empty locally (uses `./local.db`). Use Turso in production |
| `APP_TIMEZONE` | e.g. `Europe/London` (also editable in Settings) |

## Deploy (free)

1. **Database:** create a free [Turso](https://turso.tech) database. Copy its `libsql://…` URL and an auth token.
2. **Hosting:** import this repo into [Vercel](https://vercel.com). Add the environment variables above and deploy.
3. **First visit:** log in. The app syncs your full Hevy history automatically, then refreshes every 30 minutes as you use it.
4. **Settings:** set the **Phase 1 start date**. That week is a deload, then progression starts.
5. **Hevy:** turn on RPE (Settings → Workouts) and log it on your first 2–3 lifts.
6. **Apple Health:** follow [`docs/apple-shortcut.md`](docs/apple-shortcut.md).

## Layout

```
src/lib/engine/   pure rules: classify history, schedule, volume, progression, nutrition
src/lib/sources.ts   every citation the rules use
src/lib/hevy.ts      Hevy API sync (full history, then the events feed)
src/lib/claude.ts    daily note + meals (Anthropic SDK)
src/lib/db.ts        libSQL storage (rows keyed by user_id, so friends can be added later)
src/app/             Today page, settings, login, /api/health (Shortcut ingest)
```
