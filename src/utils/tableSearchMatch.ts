const SEARCH_SKIP_KEYS = new Set(["imageUrl", "imageData", "password", "refreshToken"]);

const DEFAULT_MAX_DEPTH = 3;

function shouldSkipSearchKey(key: string, excludeKeys: Set<string>): boolean {
  if (excludeKeys.has(key)) {
    return true;
  }
  if (key === "id" || key.endsWith("Id")) {
    return true;
  }
  return false;
}

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

function appendValueParts(
  parts: string[],
  value: unknown,
  depth: number,
  maxDepth: number,
  excludeKeys: Set<string>
): void {
  const primitive = primitiveToSearchString(value);
  if (primitive != null) {
    parts.push(primitive);
    return;
  }
  if (value instanceof Date) {
    parts.push(value.toISOString());
    parts.push(value.toLocaleString());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      appendValueParts(parts, item, depth, maxDepth, excludeKeys);
    }
    return;
  }
  if (value != null && typeof value === "object" && depth < maxDepth) {
    deepObjectToSearchableParts(
      value as Record<string, unknown>,
      parts,
      depth + 1,
      maxDepth,
      excludeKeys
    );
  }
}

function deepObjectToSearchableParts(
  row: Record<string, unknown>,
  parts: string[],
  depth: number,
  maxDepth: number,
  excludeKeys: Set<string>
): void {
  for (const [key, value] of Object.entries(row)) {
    if (shouldSkipSearchKey(key, excludeKeys)) {
      continue;
    }
    appendValueParts(parts, value, depth, maxDepth, excludeKeys);
  }
}

/** Flatten primitive and nested object fields into one searchable string (max depth 3). */
export function deepObjectToSearchableText(
  row: Record<string, unknown>,
  maxDepth: number = DEFAULT_MAX_DEPTH,
  excludeKeys: Set<string> = SEARCH_SKIP_KEYS
): string {
  const parts: string[] = [];
  deepObjectToSearchableParts(row, parts, 0, maxDepth, excludeKeys);
  return parts.join(" ");
}

/** Flatten primitive fields on a row into one searchable string (top-level only). */
export function objectToSearchableText(
  row: Record<string, unknown>,
  excludeKeys: Set<string> = SEARCH_SKIP_KEYS
): string {
  return deepObjectToSearchableText(row, 1, excludeKeys);
}

function accessorValueToString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return `${value.toISOString()} ${value.toLocaleString()}`;
  }
  if (typeof value === "object") {
    return deepObjectToSearchableText(value as Record<string, unknown>);
  }
  return String(value);
}

/** Build searchable text from sort/display accessor column values. */
export function buildSearchableTextFromAccessors<T>(
  row: T,
  accessors: Record<string, (row: T) => unknown>
): string {
  const parts: string[] = [];
  for (const accessor of Object.values(accessors)) {
    const text = accessorValueToString(accessor(row));
    if (text != null && text.length > 0) {
      parts.push(text);
    }
  }
  return parts.join(" ");
}

/** Default haystack: deep row flatten + all sort-accessor column values. */
export function buildDefaultSearchableText<T>(
  row: T,
  accessors?: Record<string, (row: T) => unknown>
): string {
  const parts: string[] = [];
  if (row != null && typeof row === "object") {
    parts.push(deepObjectToSearchableText(row as Record<string, unknown>));
  } else if (row != null) {
    parts.push(String(row));
  }
  if (accessors) {
    const accessorText = buildSearchableTextFromAccessors(row, accessors);
    if (accessorText.length > 0) {
      parts.push(accessorText);
    }
  }
  return parts.join(" ");
}

export function rowMatchesSearch<T>(
  row: T,
  query: string,
  getSearchableText?: (row: T) => string,
  sortAccessors?: Record<string, (row: T) => unknown>
): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return true;
  }
  const haystack =
    getSearchableText != null
      ? getSearchableText(row)
      : buildDefaultSearchableText(row, sortAccessors);
  return matchesSearchQuery(haystack, trimmed);
}

export function filterRowsBySearch<T>(
  rows: T[],
  query: string,
  getSearchableText?: (row: T) => string,
  sortAccessors?: Record<string, (row: T) => unknown>
): T[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return rows;
  }
  return rows.filter((row) =>
    rowMatchesSearch(row, trimmed, getSearchableText, sortAccessors)
  );
}
