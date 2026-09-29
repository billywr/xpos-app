const KES_LOCALE = "en-KE";

/**
 * Format amount as currency (defaults to KES - Kenya Shilling).
 * Strictly enforces 2 decimal places and handles null/undefined/string inputs.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "KES",
): string {
  if (amount === null || amount === undefined) {
    return new Intl.NumberFormat(KES_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
  const num = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return new Intl.NumberFormat(KES_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
  return new Intl.NumberFormat(KES_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Format a number as a plain decimal amount (no currency symbol), fixed strictly 2-dp. */
export function formatAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "0.00";
  }
  const num = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return "0.00";
  }
  return new Intl.NumberFormat(KES_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Format percentage up to specified decimal places (defaults to 2-dp). */
export function formatPercent(
  val: number | string | null | undefined,
  decimals = 2,
): string {
  if (val === null || val === undefined) {
    return `0.${"0".repeat(decimals)}%`;
  }
  const num = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return `0.${"0".repeat(decimals)}%`;
  }
  return `${num.toFixed(decimals)}%`;
}

