import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "coach_session";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function createSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `me.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isLoggedIn(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const i = v.lastIndexOf(".");
  const payload = v.slice(0, i);
  const sig = v.slice(i + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload.split(".")[1]);
  return exp * 1000 > Date.now();
}

export async function requireLogin() {
  if (!(await isLoggedIn())) redirect("/login");
}

export function checkPassword(pw: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  return safeEqual(pw, expected);
}
