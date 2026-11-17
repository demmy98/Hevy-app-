import "server-only";
import { createClient, type Client } from "@libsql/client";
import type { CheckIn, ExerciseTemplate, HealthDay, HevyWorkout, HrSample, Profile, WeighIn } from "./engine/types";

// Single-user today; every table carries user_id so friends can be added later.
export const USER_ID = "me";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function db(): Client {
  if (!client) {
    client = createClient({
      url: process.env.DATABASE_URL ?? "file:local.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return client;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profile (user_id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS workouts (user_id TEXT NOT NULL, id TEXT NOT NULL, start_time TEXT NOT NULL, updated_at TEXT, data TEXT NOT NULL, PRIMARY KEY (user_id, id))`,
  `CREATE TABLE IF NOT EXISTS templates (user_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (user_id, id))`,
  `CREATE TABLE IF NOT EXISTS checkins (user_id TEXT NOT NULL, date TEXT NOT NULL, sleep INT, soreness INT, energy INT, PRIMARY KEY (user_id, date))`,
  `CREATE TABLE IF NOT EXISTS weighins (user_id TEXT NOT NULL, date TEXT NOT NULL, weight_kg REAL NOT NULL, PRIMARY KEY (user_id, date))`,
  `CREATE TABLE IF NOT EXISTS health_days (user_id TEXT NOT NULL, date TEXT NOT NULL, steps INT, active_kcal REAL, PRIMARY KEY (user_id, date))`,
  `CREATE TABLE IF NOT EXISTS hr_samples (user_id TEXT NOT NULL, ts TEXT NOT NULL, bpm REAL NOT NULL, PRIMARY KEY (user_id, ts))`,
  `CREATE TABLE IF NOT EXISTS plans (user_id TEXT NOT NULL, date TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, date))`,
  `CREATE TABLE IF NOT EXISTS meta (user_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT, PRIMARY KEY (user_id, key))`,
];

async function q() {
  if (!ready) ready = db().batch(SCHEMA, "write").then(() => undefined);
  await ready;
  return db();
}

export const DEFAULT_PROFILE: Profile = {
  sex: "male",
  age: 27,
  heightCm: 174,
  weightKg: 80,
  timezone: process.env.APP_TIMEZONE ?? "Europe/London",
  phaseStart: null,
  calorieAdjust: 0,
  lastRecalibration: null,
  foods: ["rice", "pork", "eggs", "mixed vegetables"],
};

export async function getProfile(): Promise<Profile> {
  const c = await q();
  const r = await c.execute({ sql: "SELECT data FROM profile WHERE user_id = ?", args: [USER_ID] });
  return r.rows[0] ? { ...DEFAULT_PROFILE, ...JSON.parse(String(r.rows[0].data)) } : DEFAULT_PROFILE;
}

export async function saveProfile(p: Profile) {
  const c = await q();
  await c.execute({
    sql: "INSERT INTO profile (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data",
    args: [USER_ID, JSON.stringify(p)],
  });
}

export async function upsertWorkouts(ws: (HevyWorkout & { updated_at?: string })[]) {
  if (!ws.length) return;
  const c = await q();
  await c.batch(
    ws.map((w) => ({
      sql: "INSERT INTO workouts (user_id, id, start_time, updated_at, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET start_time = excluded.start_time, updated_at = excluded.updated_at, data = excluded.data",
      args: [USER_ID, w.id, w.start_time, w.updated_at ?? null, JSON.stringify(w)],
    })),
    "write",
  );
}

export async function deleteWorkouts(ids: string[]) {
  if (!ids.length) return;
  const c = await q();
  await c.batch(ids.map((id) => ({ sql: "DELETE FROM workouts WHERE user_id = ? AND id = ?", args: [USER_ID, id] })), "write");
}

export async function getWorkouts(): Promise<HevyWorkout[]> {
  const c = await q();
  const r = await c.execute({ sql: "SELECT data FROM workouts WHERE user_id = ? ORDER BY start_time", args: [USER_ID] });
  return r.rows.map((row) => JSON.parse(String(row.data)));
}

export async function replaceTemplates(ts: ExerciseTemplate[]) {
  const c = await q();
  await c.batch(
    [
      { sql: "DELETE FROM templates WHERE user_id = ?", args: [USER_ID] },
      ...ts.map((t) => ({ sql: "INSERT INTO templates (user_id, id, data) VALUES (?, ?, ?)", args: [USER_ID, t.id, JSON.stringify(t)] })),
    ],
    "write",
  );
}

export async function getTemplates(): Promise<ExerciseTemplate[]> {
  const c = await q();
  const r = await c.execute({ sql: "SELECT data FROM templates WHERE user_id = ?", args: [USER_ID] });
  return r.rows.map((row) => JSON.parse(String(row.data)));
}

export async function saveCheckIn(ci: CheckIn) {
  const c = await q();
  await c.execute({
    sql: "INSERT INTO checkins (user_id, date, sleep, soreness, energy) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET sleep = excluded.sleep, soreness = excluded.soreness, energy = excluded.energy",
    args: [USER_ID, ci.date, ci.sleep, ci.soreness, ci.energy],
  });
}

export async function getCheckIn(date: string): Promise<CheckIn | null> {
  const c = await q();
  const r = await c.execute({ sql: "SELECT * FROM checkins WHERE user_id = ? AND date = ?", args: [USER_ID, date] });
  const row = r.rows[0];
  return row ? { date, sleep: Number(row.sleep), soreness: Number(row.soreness), energy: Number(row.energy) } : null;
}

export async function saveWeighIn(w: WeighIn) {
  const c = await q();
  await c.execute({
    sql: "INSERT INTO weighins (user_id, date, weight_kg) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg",
    args: [USER_ID, w.date, w.weightKg],
  });
}

export async function getWeighIns(): Promise<WeighIn[]> {
  const c = await q();
  const r = await c.execute({ sql: "SELECT date, weight_kg FROM weighins WHERE user_id = ? ORDER BY date", args: [USER_ID] });
  return r.rows.map((row) => ({ date: String(row.date), weightKg: Number(row.weight_kg) }));
}

export async function saveHealth(days: HealthDay[], samples: HrSample[]) {
  const c = await q();
  const stmts = [
    ...days.map((d) => ({
      sql: "INSERT INTO health_days (user_id, date, steps, active_kcal) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET steps = COALESCE(excluded.steps, steps), active_kcal = COALESCE(excluded.active_kcal, active_kcal)",
      args: [USER_ID, d.date, d.steps, d.activeEnergyKcal],
    })),
    ...samples.map((s) => ({
      sql: "INSERT INTO hr_samples (user_id, ts, bpm) VALUES (?, ?, ?) ON CONFLICT(user_id, ts) DO UPDATE SET bpm = excluded.bpm",
      args: [USER_ID, s.ts, s.bpm],
    })),
  ];
  if (stmts.length) await c.batch(stmts, "write");
}

export async function getHealth(sinceDate: string): Promise<{ days: HealthDay[]; hr: HrSample[] }> {
  const c = await q();
  const d = await c.execute({ sql: "SELECT * FROM health_days WHERE user_id = ? AND date >= ?", args: [USER_ID, sinceDate] });
  const h = await c.execute({ sql: "SELECT ts, bpm FROM hr_samples WHERE user_id = ? AND ts >= ?", args: [USER_ID, sinceDate] });
  return {
    days: d.rows.map((r) => ({
      date: String(r.date),
      steps: r.steps === null ? null : Number(r.steps),
      activeEnergyKcal: r.active_kcal === null ? null : Number(r.active_kcal),
    })),
    hr: h.rows.map((r) => ({ ts: String(r.ts), bpm: Number(r.bpm) })),
  };
}

export async function savePlanText(date: string, text: string) {
  const c = await q();
  await c.execute({
    sql: "INSERT INTO plans (user_id, date, text, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET text = excluded.text, created_at = excluded.created_at",
    args: [USER_ID, date, text, new Date().toISOString()],
  });
}

export async function getPlanText(date: string): Promise<string | null> {
  const c = await q();
  const r = await c.execute({ sql: "SELECT text FROM plans WHERE user_id = ? AND date = ?", args: [USER_ID, date] });
  return r.rows[0] ? String(r.rows[0].text) : null;
}

export async function getMeta(key: string): Promise<string | null> {
  const c = await q();
  const r = await c.execute({ sql: "SELECT value FROM meta WHERE user_id = ? AND key = ?", args: [USER_ID, key] });
  return r.rows[0] ? String(r.rows[0].value) : null;
}

export async function setMeta(key: string, value: string) {
  const c = await q();
  await c.execute({
    sql: "INSERT INTO meta (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
    args: [USER_ID, key, value],
  });
}
