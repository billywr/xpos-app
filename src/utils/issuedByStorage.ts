import type { SearchableSelectOption } from "@/components/SearchableSelect";

const KEY_PREFIX = "xpos-debt-issued-by-names";

function storageKey(orgId: string, branchId: string): string {
  return `${KEY_PREFIX}:${orgId}:${branchId}`;
}

/** Names saved locally for the Issued by combobox (org + branch scoped). */
export function readSavedIssuedByNames(orgId: string, branchId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(orgId, branchId));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
    );
  } catch {
    return [];
  }
}

/** Append a name to the saved list (deduped, most recent first). */
export function addSavedIssuedByName(
  orgId: string,
  branchId: string,
  name: string
): void {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }
  const existing = readSavedIssuedByNames(orgId, branchId).filter(
    (n) => n.localeCompare(trimmed, undefined, { sensitivity: "base" }) !== 0
  );
  const merged = [trimmed, ...existing];
  try {
    localStorage.setItem(storageKey(orgId, branchId), JSON.stringify(merged));
  } catch {
    // localStorage unavailable or full
  }
}

export function buildIssuedBySelectOptions(names: string[]): SearchableSelectOption[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(trimmed);
  }
  return unique
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((name) => ({ value: name, label: name }));
}
