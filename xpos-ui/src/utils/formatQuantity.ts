const QTY_LOCALE = "en-KE";

/**
 * Quantity display: up to 2 dp, strips trailing zeros (9 → "9", 2.5 → "2.5", 8.25 → "8.25").
 */
export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat(QTY_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Parse user qty input: non-negative, max 2 decimal places. Empty → 0. */
export function parseQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Format signed variance (+/-) with formatQty on the magnitude. */
export function formatQtyVariance(v: number): string {
  if (v === 0) return formatQty(0);
  const sign = v > 0 ? "+" : "-";
  return `${sign}${formatQty(Math.abs(v))}`;
}

/** Allow empty, in-progress decimal point, and up to 2 fractional digits while typing. */
export function isValidQtyInput(value: string): boolean {
  return value === "" || /^\d*(\.\d{0,2})?$/.test(value);
}

/** Round to 2 decimal places for persisted qty values. */
export function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}
