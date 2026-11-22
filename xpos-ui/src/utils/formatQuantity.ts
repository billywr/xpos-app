const QTY_LOCALE = "en-KE";

/**
 * Quantity display: up to 2 dp, strips trailing zeros (9 → "9", 2.5 → "2.5", 8.25 → "8.25").
 */
export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = roundQty(n);
  return new Intl.NumberFormat(QTY_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(r === 0 ? 0 : r);
}

/** Parse user qty input: non-negative, max 2 decimal places. Empty → 0. */
export function parseQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? roundQty(n) : null;
}

/** Format signed variance (+/-) with formatQty on the magnitude. */
export function formatQtyVariance(v: number): string {
  const rounded = roundQty(v);
  if (rounded === 0) return formatQty(0);
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${formatQty(Math.abs(rounded))}`;
}

/** Allow empty, in-progress decimal point, and up to 2 fractional digits while typing. */
export function isValidQtyInput(value: string): boolean {
  return value === "" || /^\d*(\.\d{0,2})?$/.test(value);
}

/** Round to 2 decimal places using financial rounding to eliminate floating-point artifacts. */
export function roundQty(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

/**
 * Format quantity for input fields (no commas, max 2 decimal places, no trailing zeros).
 * Example: 2 -> "2", 2.5 -> "2.5", 8.95 -> "8.95", 1.9999999999999991 -> "2".
 */
export function formatQtyInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  const r = roundQty(n);
  const formatted = r.toFixed(2).replace(/\.?0+$/, "");
  return formatted === "" ? "0" : formatted;
}
