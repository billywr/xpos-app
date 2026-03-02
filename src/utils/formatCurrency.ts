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
