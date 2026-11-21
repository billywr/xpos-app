import type { SearchableSelectOption } from "@/components/SearchableSelect";

const KEY_PREFIX = "xpos-debt-issued-by-names";
const DELETED_KEY_PREFIX = "xpos-debt-deleted-issued-by-names";

function storageKey(orgId: string, branchId: string): string {
  return `${KEY_PREFIX}:${orgId}:${branchId}`;
}

function deletedStorageKey(orgId: string, branchId: string): string {
  return `${DELETED_KEY_PREFIX}:${orgId}:${branchId}`;
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

/** Names explicitly deleted/removed from Issued by suggestions. */
export function readDeletedIssuedByNames(orgId: string, branchId: string): string[] {
  try {
    const raw = localStorage.getItem(deletedStorageKey(orgId, branchId));
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

/** Append a name to the saved list (deduped, most recent first). Also un-deletes if previously deleted. */
export function addSavedIssuedByName(
  orgId: string,
  branchId: string,
  name: string
): void {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }

  // 1. Un-delete if present in deleted list
  const currentDeleted = readDeletedIssuedByNames(orgId, branchId);
  const nextDeleted = currentDeleted.filter(
    (d) => d.localeCompare(trimmed, undefined, { sensitivity: "base" }) !== 0
  );
  if (nextDeleted.length !== currentDeleted.length) {
    try {
      localStorage.setItem(deletedStorageKey(orgId, branchId), JSON.stringify(nextDeleted));
    } catch {
      // localStorage unavailable or full
    }
  }

  // 2. Add to saved list
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

/** Remove a name from the saved list and add it to the deleted list so it no longer appears in suggestions. */
export function removeSavedIssuedByName(
  orgId: string,
  branchId: string,
  name: string
): void {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }

  // 1. Remove from saved list
  const existing = readSavedIssuedByNames(orgId, branchId).filter(
    (n) => n.localeCompare(trimmed, undefined, { sensitivity: "base" }) !== 0
  );
  try {
    localStorage.setItem(storageKey(orgId, branchId), JSON.stringify(existing));
  } catch {
    // localStorage unavailable or full
  }

  // 2. Add to deleted list
  const currentDeleted = readDeletedIssuedByNames(orgId, branchId);
  if (!currentDeleted.some((d) => d.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0)) {
    try {
      localStorage.setItem(
        deletedStorageKey(orgId, branchId),
        JSON.stringify([...currentDeleted, trimmed])
      );
    } catch {
      // localStorage unavailable or full
    }
  }
}

export function buildIssuedBySelectOptions(
  names: string[],
  deletedNames: string[] = []
): SearchableSelectOption[] {
  const deletedSet = new Set(
    deletedNames.map((d) => d.trim().toLocaleLowerCase()).filter(Boolean)
  );
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLocaleLowerCase();
    if (deletedSet.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(trimmed);
  }
  return unique
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((name) => ({ value: name, label: name }));
}
