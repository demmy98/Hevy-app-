import Link from "next/link";
import { requireLogin } from "@/lib/auth";
import { getProfile } from "@/lib/db";
import { saveSettingsAction, syncAction } from "../actions";
import { SubmitButton } from "../client";

export const dynamic = "force-dynamic";

export default async function Settings() {
  await requireLogin();
  const p = await getProfile();
  return (
    <>
      <h1>Settings</h1>
      <form action={saveSettingsAction} className="card settings">
        <label>Sex
          <select name="sex" defaultValue={p.sex}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label>Age<input name="age" type="number" defaultValue={p.age} /></label>
        <label>Height (cm)<input name="heightCm" type="number" defaultValue={p.heightCm} /></label>
        <label>Starting weight (kg). Weigh-ins override this.<input name="weightKg" type="number" step="0.1" defaultValue={p.weightKg} /></label>
        <label>Time zone (IANA)<input name="timezone" defaultValue={p.timezone} /></label>
        <label>Phase 1 start (first day of the deload week)<input name="phaseStart" type="date" defaultValue={p.phaseStart ?? ""} /></label>
        <label>Staple foods (comma-separated)<input name="foods" defaultValue={p.foods.join(", ")} /></label>
        <p className="muted">Calorie adjustment from weigh-in trend: {p.calorieAdjust > 0 ? "+" : ""}{p.calorieAdjust} kcal/day{p.lastRecalibration ? ` (last changed ${p.lastRecalibration})` : ""}.</p>
        <SubmitButton>Save</SubmitButton>
      </form>
      <form action={syncAction} className="card">
        <input type="hidden" name="full" value="1" />
        <h2>Hevy</h2>
        <p className="muted">A full re-sync re-downloads all workouts and exercise templates.</p>
        <SubmitButton className="secondary">Full re-sync</SubmitButton>
      </form>
      <Link href="/">← Back to today</Link>
    </>
  );
}
