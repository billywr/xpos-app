const KES_LOCALE = "en-KE";

/**
 * Format amount as currency (defaults to KES - Kenya Shilling).
 * Only displays cents if the amount actually has cents (e.g. 900 -> "KSh 900", 900.5 -> "KSh 900.50").
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "KES",
): string {
  if (amount === null || amount === undefined) {
    return new Intl.NumberFormat(KES_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  const num = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return new Intl.NumberFormat(KES_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [, decStr] = fixed.split(".");
  const hasCents = decStr !== "00";

  return new Intl.NumberFormat(KES_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(num);
}

/** 
 * Format a number as a plain decimal amount (no currency symbol).
 * Only displays cents if the amount actually has cents (e.g. 900 -> "900", 6000 -> "6,000", 900.5 -> "900.50").
 */
export function formatAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "0";
  }
  const num = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return "0";
  }
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [intStr, decStr] = fixed.split(".");
  const hasCents = decStr !== "00";
  const sign = num < 0 ? "-" : "";

  const formattedInt = new Intl.NumberFormat(KES_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(intStr));

  return hasCents ? `${sign}${formattedInt}.${decStr}` : `${sign}${formattedInt}`;
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

