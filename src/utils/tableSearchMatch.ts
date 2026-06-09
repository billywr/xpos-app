const SEARCH_SKIP_KEYS = new Set(["imageUrl", "imageData", "password", "refreshToken"]);

/**
 * Normalize text for fuzzy table search: lowercase, strip accents, remove punctuation/spacing.
 * e.g. "K.C 250ml" → "kc250ml", so query "kc" matches.
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function matchesSearchQuery(haystack: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return true;
  }
  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedQuery = normalizeSearchText(trimmed);
  if (normalizedQuery.length > 0 && normalizedHaystack.includes(normalizedQuery)) {
    return true;
  }
  return haystack.toLowerCase().includes(trimmed.toLowerCase());
}

function primitiveToSearchString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  return null;
}

/** Flatten primitive fields on a row into one searchable string. */
export function objectToSearchableText(
  row: Record<string, unknown>,
  excludeKeys: Set<string> = SEARCH_SKIP_KEYS
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (excludeKeys.has(key)) {
      continue;
    }
    const primitive = primitiveToSearchString(value);
    if (primitive != null) {
      parts.push(primitive);
      continue;
    }
    if (value instanceof Date) {
      parts.push(value.toISOString());
      parts.push(value.toLocaleString());
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const itemText = primitiveToSearchString(item);
        if (itemText != null) {
          parts.push(itemText);
        }
      }
    }
  }
  return parts.join(" ");
}

export function rowMatchesSearch<T>(
  row: T,
  query: string,
  getSearchableText?: (row: T) => string
): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return true;
  }
  const haystack =
    getSearchableText != null
      ? getSearchableText(row)
      : row != null && typeof row === "object"
        ? objectToSearchableText(row as Record<string, unknown>)
        : String(row ?? "");
  return matchesSearchQuery(haystack, trimmed);
}

export function filterRowsBySearch<T>(
  rows: T[],
  query: string,
  getSearchableText?: (row: T) => string
): T[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return rows;
  }
  return rows.filter((row) => rowMatchesSearch(row, trimmed, getSearchableText));
}
