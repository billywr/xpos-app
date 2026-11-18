/**
 * Centralized date and datetime formatting utilities for XPOS.
 * Standardizes display format across the system to dd/mm/yyyy (e.g. 17/12/2026).
 */

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a date value as dd/mm/yyyy (e.g. 17/12/2026).
 * Safe against UTC timezone-shift bugs when given ISO date strings (YYYY-MM-DD).
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = "—"
): string {
  if (value == null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;

    // Direct YYYY-MM-DD pattern: avoid new Date() to prevent timezone shifting
    const match = ISO_DATE_REGEX.exec(trimmed);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }

    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      return fallback;
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return fallback;
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export interface FormatDateTimeOptions {
  includeSeconds?: boolean;
  fallback?: string;
}

/**
 * Formats a timestamp into dd/mm/yyyy, HH:mm (or dd/mm/yyyy, HH:mm:ss).
 * e.g. 17/12/2026, 14:30
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options?: FormatDateTimeOptions
): string {
  const fallback = options?.fallback ?? "—";
  if (value == null || value === "") {
    return fallback;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return fallback;
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");

  if (options?.includeSeconds) {
    const secs = String(d.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year}, ${hours}:${mins}:${secs}`;
  }

  return `${day}/${month}/${year}, ${hours}:${mins}`;
}

/**
 * Converts a Date or ISO string into YYYY-MM-DD for <input type="date"> value bindings.
 */
export function formatDateInput(
  value: string | number | Date | null | undefined
): string {
  if (value == null || value === "") {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (ISO_DATE_REGEX.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
