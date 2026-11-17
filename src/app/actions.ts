"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, createSession, destroySession, requireLogin } from "@/lib/auth";
import { getProfile, getWeighIns, saveCheckIn, savePlanText, saveProfile, saveWeighIn } from "@/lib/db";
import { syncHevy } from "@/lib/hevy";
import { recalibrate } from "@/lib/engine/nutrition";
import { localDay } from "@/lib/engine/time";
import { loadTodayPlan } from "@/lib/today";
import { writeDailyNote } from "@/lib/claude";

const clamp15 = (v: FormDataEntryValue | null) => Math.min(5, Math.max(1, Math.round(Number(v) || 3)));

export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: "Wrong password." };
  await createSession();
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function syncAction(form: FormData) {
  await requireLogin();
  await syncHevy({ full: form.get("full") === "1" });
  revalidatePath("/");
}

export async function checkInAction(form: FormData) {
  await requireLogin();
  const profile = await getProfile();
  await saveCheckIn({
    date: localDay(new Date(), profile.timezone),
    sleep: clamp15(form.get("sleep")),
    soreness: clamp15(form.get("soreness")),
    energy: clamp15(form.get("energy")),
  });
  revalidatePath("/");
}

export async function weighInAction(form: FormData) {
  await requireLogin();
  const kg = Number(form.get("weight"));
  if (!(kg > 30 && kg < 300)) return;
  const profile = await getProfile();
  const today = localDay(new Date(), profile.timezone);
  await saveWeighIn({ date: today, weightKg: Math.round(kg * 10) / 10 });
  const r = recalibrate(await getWeighIns(), profile.calorieAdjust, profile.lastRecalibration, today);
  if (r.changed) await saveProfile({ ...profile, calorieAdjust: r.adjust, lastRecalibration: today });
  revalidatePath("/");
}

export async function generateNoteAction(): Promise<{ error?: string }> {
  await requireLogin();
  try {
    const { plan, profile } = await loadTodayPlan();
    const text = await writeDailyNote(plan, profile);
    await savePlanText(plan.date, text);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate the note." };
  }
  revalidatePath("/");
  return {};
}

export async function saveSettingsAction(form: FormData) {
  await requireLogin();
  const p = await getProfile();
  const num = (k: string, d: number) => {
    const v = Number(form.get(k));
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  await saveProfile({
    ...p,
    sex: form.get("sex") === "female" ? "female" : "male",
    age: num("age", p.age),
    heightCm: num("heightCm", p.heightCm),
    weightKg: num("weightKg", p.weightKg),
    timezone: String(form.get("timezone") || p.timezone),
    phaseStart: String(form.get("phaseStart") || "") || null,
    foods: String(form.get("foods") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  revalidatePath("/");
  redirect("/");
}
