/**
 * Stock receiving (Goods Receipt / Add stock) configuration and limits.
 * Protects against fat-finger errors (e.g. typing 10000 instead of 10 or 100).
 */

export const STOCK_RECEIPT_MAX_QTY_KEY = "admin.goods_receipt.max_qty";
export const STOCK_RECEIPT_DIGITS_ONLY_KEY = "admin.goods_receipt.digits_only";
export const STOCK_RECEIPT_SHOW_LIMIT_KEY = "admin.goods_receipt.show_limit";

/** Default max quantity when not configured: 99 (2 digits). */
export const DEFAULT_STOCK_RECEIPT_MAX_QTY = 99;

/** Quick preset options available in the Settings page. */
export const STOCK_RECEIPT_QTY_PRESETS = [
  { label: "99 (2 digits)", value: 99 },
  { label: "100", value: 100 },
  { label: "200", value: 200 },
  { label: "500", value: 500 },
  { label: "1,000", value: 1000 },
] as const;

/**
 * Returns the configured maximum stock receiving quantity per line.
 * Defaults to 99 (2 digits) if not configured or invalid.
 */
export function getStockReceiptMaxQty(
  labels: Record<string, string> | undefined | null
): number {
  if (!labels) return DEFAULT_STOCK_RECEIPT_MAX_QTY;
  const raw = labels[STOCK_RECEIPT_MAX_QTY_KEY];
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_STOCK_RECEIPT_MAX_QTY;
}

/**
 * Returns whether stock receiving quantities are limited to whole digits only (0-9).
 * Defaults to true.
 */
export function isStockReceiptDigitsOnly(
  labels: Record<string, string> | undefined | null
): boolean {
  if (!labels) return true;
  const raw = labels[STOCK_RECEIPT_DIGITS_ONLY_KEY];
  if (raw === "false") return false;
  return true;
}

/**
 * Returns whether the maximum quantity badge is displayed in the Add stock form.
 * Defaults to false (hidden).
 */
export function isStockReceiptShowLimit(
  labels: Record<string, string> | undefined | null
): boolean {
  if (!labels) return false;
  return labels[STOCK_RECEIPT_SHOW_LIMIT_KEY] === "true";
}

/**
 * Sanitizes quantity input as the user types.
 * - Strips non-digits when digitsOnly is true (or non-numbers when false).
 * - Formats with comma thousands separators (e.g. 1,000).
 * - If the entered numeric value exceeds maxQty, it flips back to maxQty.
 */
export function sanitizeStockReceiptQty(
  input: string,
  maxQty: number,
  digitsOnly: boolean = true
): string {
  if (!input) return "";

  if (digitsOnly) {
    const digits = input.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10);
    if (Number.isNaN(num)) return "";
    if (num > maxQty) {
      return maxQty.toLocaleString("en-US");
    }
    return num.toLocaleString("en-US");
  }

  // When digitsOnly is false (decimal quantities permitted)
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  const parts = cleaned.split(".");
  const intStr = parts[0];
  const decStr = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : undefined;

  const numVal = parseFloat((intStr || "0") + (decStr !== undefined ? "." + decStr : ""));
  if (!Number.isNaN(numVal) && numVal > maxQty) {
    return maxQty.toLocaleString("en-US");
  }

  const intNum = intStr ? parseInt(intStr, 10) : 0;
  const formattedInt = intStr ? intNum.toLocaleString("en-US") : "0";

  if (decStr !== undefined) {
    if (decStr === "" && input.endsWith(".")) {
      return `${formattedInt}.`;
    }
    return `${formattedInt}.${decStr}`;
  }

  return formattedInt;
}

