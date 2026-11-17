"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function Login() {
  const [state, action, pending] = useActionState(loginAction, {} as { error?: string });
  return (
    <div className="card" style={{ marginTop: 60 }}>
      <h1>Hevy Coach</h1>
      <form action={action} className="inline" style={{ marginTop: 12 }}>
        <label style={{ flex: 1 }}>
          Password
          <input name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        <button type="submit" disabled={pending}>{pending ? "…" : "Log in"}</button>
      </form>
      {state?.error && <p className="error">{state.error}</p>}
    </div>
  );
}
