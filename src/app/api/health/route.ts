import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/auth";
import { getProfile, saveHealth } from "@/lib/db";
import { localDay } from "@/lib/engine/time";
import type { HrSample } from "@/lib/engine/types";
import { parseLocaleNumber } from "@/lib/parse";

// Apple Health ingest for the iOS Shortcut (docs/apple-shortcut.md).
// Auth: "Authorization: Bearer <HEALTH_INGEST_TOKEN>".

const num = z.union([z.number(), z.string()]).transform((v) => parseLocaleNumber(v)).pipe(z.number().finite());
const int = z.union([z.number(), z.string()]).transform((v) => parseLocaleNumber(v, { integer: true })).pipe(z.number().finite());

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  steps: int.optional(),
  activeEnergy: num.optional(),
  // Either an array of {date, value} or two newline-separated lists (easiest from Shortcuts).
  heartRate: z.array(z.object({ date: z.string(), value: num })).optional(),
  hrDates: z.string().optional(),
  hrValues: z.string().optional(),
});

export async function POST(req: Request) {
  const token = process.env.HEALTH_INGEST_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  if (!token || !safeEqual(auth, `Bearer ${token}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;

  const profile = await getProfile();
  const date = b.date ?? localDay(new Date(), profile.timezone);

  const samples: HrSample[] = [];
  for (const s of b.heartRate ?? []) samples.push({ ts: s.date, bpm: s.value });
  if (b.hrDates && b.hrValues) {
    const ds = b.hrDates.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const vs = b.hrValues.split(/\r?\n/).map((s) => parseLocaleNumber(s));
    ds.forEach((d, i) => Number.isFinite(vs[i]) && samples.push({ ts: d, bpm: vs[i] }));
  }
  const valid = samples
    .filter((s) => !Number.isNaN(+new Date(s.ts)) && s.bpm > 25 && s.bpm < 240)
    .map((s) => ({ ts: new Date(s.ts).toISOString(), bpm: Math.round(s.bpm) }));

  const hasDay = b.steps !== undefined || b.activeEnergy !== undefined;
  await saveHealth(
    hasDay ? [{ date, steps: b.steps !== undefined ? Math.round(b.steps) : null, activeEnergyKcal: b.activeEnergy ?? null }] : [],
    valid,
  );
  return NextResponse.json({ ok: true, date, steps: b.steps ?? null, heartRateSamples: valid.length });
}
