// Date helpers working on local calendar days ("YYYY-MM-DD") in a given IANA timezone.

export function localDay(iso: string | Date, timeZone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const toUtc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));

export function addDays(day: string, n: number): string {
  return new Date(toUtc(day) + n * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(day: string): number {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}
