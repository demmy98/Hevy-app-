import "server-only";
import type { ExerciseTemplate, HevyWorkout } from "./engine/types";
import { deleteWorkouts, getMeta, replaceTemplates, setMeta, upsertWorkouts } from "./db";

// Hevy public API (requires Hevy Pro). Key from https://hevy.com/settings?developer
const BASE = "https://api.hevyapp.com/v1";

async function get<T>(path: string): Promise<T> {
  const key = process.env.HEVY_API_KEY?.trim();
  if (!key) throw new Error("HEVY_API_KEY is not set");
  const res = await fetch(BASE + path, { headers: { "api-key": key, accept: "application/json" }, cache: "no-store" });
  if (res.status === 401 || res.status === 403)
    throw new Error("Hevy rejected the API key. Check HEVY_API_KEY in Vercel (no spaces) and that Hevy Pro is active.");
  if (!res.ok) throw new Error(`Hevy API ${path.split("?")[0]} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function allPages<T>(path: (page: number) => string, pick: (j: any) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const j = await get<any>(path(page));
    out.push(...pick(j));
    if (page >= (j.page_count ?? 1)) break;
  }
  return out;
}

type WorkoutEvent =
  | { type: "updated"; workout: HevyWorkout & { updated_at?: string } }
  | { type: "deleted"; id: string; deleted_at?: string };

/**
 * Sync Hevy into the local DB. The first run pulls full history; later runs use the
 * workout events feed (updates + deletions since the last sync).
 */
export async function syncHevy(opts: { full?: boolean } = {}): Promise<{ updated: number; deleted: number; templates: number }> {
  const startedAt = new Date().toISOString();
  const since = opts.full ? null : await getMeta("hevy_last_sync");

  let updated = 0;
  let deleted = 0;
  if (!since) {
    const ws = await allPages<HevyWorkout & { updated_at?: string }>((p) => `/workouts?page=${p}&pageSize=10`, (j) => j.workouts ?? []);
    await upsertWorkouts(ws);
    updated = ws.length;
  } else {
    const events = await allPages<WorkoutEvent>(
      (p) => `/workouts/events?page=${p}&pageSize=10&since=${encodeURIComponent(since)}`,
      (j) => j.events ?? [],
    );
    const ups = events.filter((e): e is Extract<WorkoutEvent, { type: "updated" }> => e.type === "updated").map((e) => e.workout);
    const dels = events.filter((e): e is Extract<WorkoutEvent, { type: "deleted" }> => e.type === "deleted").map((e) => e.id);
    await upsertWorkouts(ups);
    await deleteWorkouts(dels);
    updated = ups.length;
    deleted = dels.length;
  }

  // Templates carry muscle groups + equipment (incl. custom exercises). Refresh daily-ish.
  const lastT = await getMeta("hevy_templates_sync");
  let templates = 0;
  if (opts.full || !lastT || Date.now() - +new Date(lastT) > 24 * 3600 * 1000) {
    const ts = await allPages<ExerciseTemplate>((p) => `/exercise_templates?page=${p}&pageSize=100`, (j) => j.exercise_templates ?? []);
    await replaceTemplates(ts);
    await setMeta("hevy_templates_sync", startedAt);
    templates = ts.length;
  }

  await setMeta("hevy_last_sync", startedAt);
  return { updated, deleted, templates };
}
