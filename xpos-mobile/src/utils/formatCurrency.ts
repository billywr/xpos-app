export function formatCurrency(amount: number | string | null | undefined, currency = ""): string {
  const prefix = currency ? `${currency} ` : "";
  if (amount === null || amount === undefined) {
    return `${prefix}0`;
  }
  const num = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return `${prefix}0`;
  }
  const sign = num < 0 ? "-" : "";
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [intStr, decStr] = fixed.split(".");
  const intPart = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decStr === "00") {
    return `${sign}${prefix}${intPart}`;
  }
  return `${sign}${prefix}${intPart}.${decStr}`;
}

export function formatAmount(amount: number | string | null | undefined): string {
  return formatCurrency(amount, "");
}

export function formatQty(qty: number | string | null | undefined): string {
  if (qty === null || qty === undefined) {
    return "0";
  }
  const num = typeof qty === "number" ? qty : Number(qty);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return "0";
  }
  // Up to 2 decimal places, strips trailing zeros: e.g. 5 -> "5", 5.2 -> "5.2", 5.25 -> "5.25"
  return Number(num.toFixed(2)).toString();
}

export function formatQtyVariance(variance: number | string | null | undefined): string {
  if (variance === null || variance === undefined) {
    return "0";
  }
  const num = typeof variance === "number" ? variance : Number(variance);
  if (Number.isNaN(num) || !Number.isFinite(num) || Math.abs(num) < 0.001) {
    return "0";
  }
  const formatted = formatQty(Math.abs(num));
  return num > 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatPercent(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) {
    return `0.${"0".repeat(decimals)}%`;
  }
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return `0.${"0".repeat(decimals)}%`;
  }
  return `${num.toFixed(decimals)}%`;
}

/**
 * Formats a raw numeric string with comma thousands separators while typing.
 * Preserves decimal point and up to 2 decimal places.
 * Example: "1000" -> "1,000", "1000.5" -> "1,000.5", "1000.50" -> "1,000.50"
 */
export function formatAmountWithCommas(raw: string): string {
  if (!raw) return "";
  const clean = raw.replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (!clean) return "";

  const parts = clean.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (parts.length > 1) {
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
  }
  return parts[0];
}

