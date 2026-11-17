/**
 * Parse numbers as iOS Shortcuts may format them depending on locale:
 * "8,412" / "8 412" / "8.412.000" (thousands) or "72,5" (decimal comma).
 * With `integer: true` (e.g. steps), any "," or "." is treated as a thousands separator.
 */
export function parseLocaleNumber(v: string | number, opts: { integer?: boolean } = {}): number {
  if (typeof v === "number") return v;
  const s = v.trim().replace(/[\s  ]/g, "");
  if (opts.integer) return Number(s.replace(/[,.]/g, ""));
  if (/^\d{1,3}(,\d{3})+$/.test(s) || /^\d{1,3}(\.\d{3}){2,}$/.test(s)) return Number(s.replace(/[,.]/g, ""));
  return Number(s.replace(",", "."));
}
