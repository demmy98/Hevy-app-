import Link from "next/link";
import { requireLogin } from "@/lib/auth";
import { loadTodayPlan } from "@/lib/today";
import { checkInAction, logoutAction, syncAction, weighInAction } from "./actions";
import { GenerateNote, Markdown, SubmitButton } from "./client";

export const dynamic = "force-dynamic";

const SESSION_LABEL: Record<string, string> = {
  upper_a: "Upper A",
  upper_b: "Upper B",
  legs: "Legs (maintenance)",
  circuit: "Conditioning circuit",
};

function Scale({ name, label, value, hint }: { name: string; label: string; value?: number; hint: string }) {
  return (
    <label>
      {label} <span className="muted">{hint}</span>
      <select name={name} defaultValue={value ?? 3}>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  );
}

export default async function Today() {
  await requireLogin();
  const { plan, checkIn, note, lastSync, syncError, workoutCount } = await loadTodayPlan();
  const { decision, nutrition, workout, circuit } = plan;
  const dateLabel = new Date(plan.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <>
      <div className="hero">
        <div>
          <div className="muted">{dateLabel}</div>
          <h1>
            {decision.action === "train" ? `Train: ${SESSION_LABEL[decision.session!]}` : decision.action === "done" ? "Done for today" : "Rest day"}
          </h1>
        </div>
        <span className={`badge ${decision.action}`}>{plan.phase.name}</span>
      </div>

      {workoutCount === 0 && (
        <div className="card">
          <h2>Connect Hevy</h2>
          <p>No workouts synced yet.</p>
          {syncError ? <p className="error">{syncError}</p> : <p>Press <b>Sync Hevy</b> at the bottom of the page.</p>}
        </div>
      )}

      <section className="card">
        <h2>1 · Why</h2>
        <ul className="reasons">
          {decision.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p className="muted">
          This week: upper {decision.week.done.upper}/{decision.week.target.upper} · legs {decision.week.done.legs}/{decision.week.target.legs} · circuit{" "}
          {decision.week.done.circuit}/{decision.week.target.circuit} · {decision.week.daysLeft} day(s) left
        </p>
        {!checkIn && decision.action !== "done" && (
          <form action={checkInAction} className="inline" style={{ marginTop: 10 }}>
            <Scale name="sleep" label="Sleep" hint="1 bad · 5 great" />
            <Scale name="soreness" label="Soreness" hint="1 none · 5 very" />
            <Scale name="energy" label="Energy" hint="1 flat · 5 high" />
            <SubmitButton>Check in</SubmitButton>
          </form>
        )}
        {checkIn && <p className="muted">Check-in: sleep {checkIn.sleep}, soreness {checkIn.soreness}, energy {checkIn.energy} → readiness {decision.readiness}/5</p>}
      </section>

      {workout && (
        <section className="card">
          <h2>2 · Workout</h2>
          <p className="muted">{plan.phase.detail}</p>
          <table>
            <thead>
              <tr><th>Exercise</th><th>Sets × reps</th><th>Load</th></tr>
            </thead>
            <tbody>
              {workout.exercises.map((e) => (
                <tr key={e.templateId}>
                  <td>
                    <div className="ex-title">{e.title}<span className={`tag ${e.action}`}>{e.action}</span></div>
                    <div className="why">{e.rationale}</div>
                    {e.last && <div className="why">Last: {e.last}</div>}
                  </td>
                  <td>{e.sets} × {e.targetReps}<div className="why">range {e.repMin}-{e.repMax}</div></td>
                  <td>{e.displayWeight}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {workout.notes.map((n) => <p key={n} className="muted">{n}</p>)}
        </section>
      )}

      {circuit && (
        <section className="card">
          <h2>2 · Circuit</h2>
          <table>
            <tbody>
              {circuit.items.map((i) => (
                <tr key={i.title}><td className="ex-title">{i.title}</td><td>{i.prescription}</td></tr>
              ))}
            </tbody>
          </table>
          {circuit.notes.map((n) => <p key={n} className="muted">{n}</p>)}
        </section>
      )}

      <section className="card">
        <h2>3 · Food: {nutrition.dayType === "rest" ? "rest day" : nutrition.dayType === "lift" ? "lifting day" : "circuit day"}</h2>
        <div className="macros">
          <div><b>{nutrition.kcal.toLocaleString("en-GB")}</b>kcal</div>
          <div><b>{nutrition.proteinG} g</b>protein</div>
          <div><b>{nutrition.carbsG} g</b>carbs</div>
          <div><b>{nutrition.fatG} g</b>fat</div>
        </div>
        <details style={{ marginTop: 8 }}>
          <summary className="muted">How the calories were worked out</summary>
          <table>
            <tbody>
              {nutrition.breakdown.map((b) => <tr key={b.label}><td>{b.label}</td><td>{b.kcal > 0 ? "+" : ""}{b.kcal}</td></tr>)}
            </tbody>
          </table>
          <p className="muted">Protein 1.8 g/kg at {nutrition.weightKg} kg. Fat 25% of calories. Carbs fill the rest, so they move with activity.</p>
        </details>
      </section>

      <section className="card note">
        <h2>Coach&apos;s note &amp; meals</h2>
        {note ? <Markdown text={note} /> : <p className="muted">Generate a written plan with 3 meals built from your usual foods.</p>}
        <GenerateNote hasNote={!!note} />
      </section>

      {plan.warnings.length > 0 && (
        <section className="card">
          <h2>Heads up</h2>
          <ul className="reasons">{plan.warnings.map((w) => <li key={w} className="warn">{w}</li>)}</ul>
        </section>
      )}

      <section className="card">
        <h2>Weekly volume (last 7 days)</h2>
        <div className="vol">
          {plan.volume.map((v) => (
            <div key={v.group.id} className={v.status}>
              {v.group.label}: <b>{v.sets}</b> <span className="muted">/ {v.group.min}-{v.group.max}</span>
            </div>
          ))}
        </div>
        {plan.lastCircuitHr && (
          <p className="muted">
            Last circuit ({plan.lastCircuitHr.day}):{" "}
            {plan.lastCircuitHr.minutesAbove === null
              ? "no heart-rate data from Apple Health for that window."
              : `${plan.lastCircuitHr.minutesAbove} min ≥ ${plan.lastCircuitHr.threshold} bpm (goal 15+).`}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Weigh-in</h2>
        <form action={weighInAction} className="inline">
          <label>Morning weight (kg)<input name="weight" type="number" step="0.1" min="30" max="300" required /></label>
          <SubmitButton>Save</SubmitButton>
        </form>
      </section>

      <section className="card sources">
        <h2>4 · Sources</h2>
        <ul>
          {plan.sources.map((s) => (
            <li key={s.id}>
              <b>{s.short}</b>: {s.claim}{" "}
              <a href={s.url} target="_blank" rel="noreferrer">{s.citation}</a>
            </li>
          ))}
        </ul>
      </section>

      <div className="row">
        <form action={syncAction}><SubmitButton className="secondary">Sync Hevy</SubmitButton></form>
        <Link href="/settings">Settings</Link>
        <form action={logoutAction}><button className="secondary" type="submit">Log out</button></form>
      </div>
      <p className="muted">
        {workoutCount} workouts · last sync {lastSync ? new Date(lastSync).toLocaleString("en-GB") : "never"}
        {syncError && <span className="error"> · sync failed: {syncError}</span>}
      </p>
    </>
  );
}
