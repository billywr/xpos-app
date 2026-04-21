const KES_LOCALE = "en-KE";

/**
 * Format amount as KES (Kenya Shilling). Use en-KE for locale.
 */
export function formatCurrency(amount: number, currency = "KES"): string {
  return new Intl.NumberFormat(KES_LOCALE, {
    style: "currency",
    currency,
  }).format(amount);
}

/** Format a number as a plain decimal amount (no currency symbol), fixed 2-dp. */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat(KES_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
