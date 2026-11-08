const trim2 = (x: number) => String(Math.round(x * 100) / 100);

/** Pakistani number style: 100,000 = 1 Lac, 10,000,000 = 1 Cr. */
export const compact = (n: number) =>
  n >= 1e7 ? `${trim2(n / 1e7)} Cr` : n >= 1e5 ? `${trim2(n / 1e5)} Lac` : Number(n).toLocaleString("en-US");

export const budgetRange = (min: number, max: number) => (min || max ? `${compact(min)} – ${compact(max)}` : "—");

export const pkr = (n: number) => `PKR ${compact(n)}`;

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const PHONE_RE = /^\+?[0-9\s\-()]{7,16}$/;

export const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
