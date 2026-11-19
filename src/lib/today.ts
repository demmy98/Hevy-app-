import "server-only";
import { getCheckIn, getHealth, getMeta, getPlanText, getProfile, getTemplates, getWeighIns, getWorkouts } from "./db";
import { buildDailyPlan } from "./engine/plan";
import { addDays, localDay } from "./engine/time";
import { syncHevy } from "./hevy";

const AUTO_SYNC_MS = 30 * 60 * 1000;

/** Load everything for today, auto-syncing Hevy if the last sync is stale. */
export async function loadTodayPlan() {
  let syncError: string | null = null;
  const last = await getMeta("hevy_last_sync");
  if (!process.env.HEVY_API_KEY?.trim()) {
    syncError = "HEVY_API_KEY isn't set on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.";
  } else if (!last || Date.now() - +new Date(last) > AUTO_SYNC_MS) {
    try {
      await syncHevy();
    } catch (e) {
      syncError = e instanceof Error ? e.message : String(e);
    }
  }

  const profile = await getProfile();
  const today = localDay(new Date(), profile.timezone);
  const [workouts, templates, checkIn, weighIns, health, note, lastSync] = await Promise.all([
    getWorkouts(),
    getTemplates(),
    getCheckIn(today),
    getWeighIns(),
    getHealth(addDays(today, -60)),
    getPlanText(today),
    getMeta("hevy_last_sync"),
  ]);

  const plan = buildDailyPlan({ today, profile, workouts, templates, checkIn, weighIns, health: health.days, hr: health.hr });
  return { plan, profile, checkIn, note, lastSync, syncError, workoutCount: workouts.length };
}
