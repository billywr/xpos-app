export const DEFAULT_EXPENSE_CATEGORIES = [
  "Bills",
  "Utilities",
  "Supplies",
  "Maintenance",
  "Transport",
  "Fuel",
  "Rent",
  "Salaries",
  "Other",
];

export const DEFAULT_INCURRED_BY_PRESETS = [
  "Self",
  "Manager",
  "Cashier",
  "Owner",
];

const CUSTOM_CATEGORIES_KEY = "xpos-custom-expense-categories";
const DELETED_CATEGORIES_KEY = "xpos-deleted-expense-categories";

const INCURRED_BY_PRESETS_KEY = "xpos-incurred-by-presets";
const DELETED_INCURRED_BY_KEY = "xpos-deleted-incurred-by";

function scopedKey(
  prefix: string,
  orgId?: string | null,
  branchId?: string | null
): string {
  const o = orgId || "default";
  const b = branchId || "default";
  return `${prefix}:${o}:${b}`;
}

function safeGetArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
    );
  } catch {
    return [];
  }
}

function safeSetArray(key: string, items: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // localStorage unavailable or full
  }
}

function caseInsensitiveMatch(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
}

// ---------------------------------------------------------------------------
// Expense Categories (Spent on)
// ---------------------------------------------------------------------------

/**
 * Reads merged expense categories: default categories + API categories + custom added,
 * minus any categories that have been deleted/hidden by the user.
 */
export function readSavedExpenseCategories(
  orgId: string | null | undefined,
  branchId: string | null | undefined,
  apiCategories: string[] = []
): string[] {
  const customList = safeGetArray(scopedKey(CUSTOM_CATEGORIES_KEY, orgId, branchId));
  const deletedList = safeGetArray(scopedKey(DELETED_CATEGORIES_KEY, orgId, branchId));

  const allMerged: string[] = [];
  const candidatePool = [...DEFAULT_EXPENSE_CATEGORIES, ...apiCategories, ...customList];

  for (const item of candidatePool) {
    const trimmed = item?.trim();
    if (!trimmed) continue;
    const isDeleted = deletedList.some((d) => caseInsensitiveMatch(d, trimmed));
    if (isDeleted) continue;
    const exists = allMerged.some((m) => caseInsensitiveMatch(m, trimmed));
    if (!exists) {
      allMerged.push(trimmed);
    }
  }

  return allMerged.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * Adds a new custom category. Also restores it if it was previously in the deleted list.
 */
export function addExpenseCategory(
  orgId: string | null | undefined,
  branchId: string | null | undefined,
  category: string,
  apiCategories: string[] = []
): string[] {
  const trimmed = category.trim();
  if (!trimmed) {
    return readSavedExpenseCategories(orgId, branchId, apiCategories);
  }

  // Remove from deleted list if present
  const delKey = scopedKey(DELETED_CATEGORIES_KEY, orgId, branchId);
  const currentDeleted = safeGetArray(delKey);
  const nextDeleted = currentDeleted.filter((d) => !caseInsensitiveMatch(d, trimmed));
  if (nextDeleted.length !== currentDeleted.length) {
    safeSetArray(delKey, nextDeleted);
  }

  // Add to custom list
  const customKey = scopedKey(CUSTOM_CATEGORIES_KEY, orgId, branchId);
  const currentCustom = safeGetArray(customKey);
  if (!currentCustom.some((c) => caseInsensitiveMatch(c, trimmed))) {
    safeSetArray(customKey, [...currentCustom, trimmed]);
  }

  return readSavedExpenseCategories(orgId, branchId, apiCategories);
}

/**
 * Removes a category from suggestions by recording it in the deleted list
 * and removing it from custom categories.
 */
export function removeExpenseCategory(
  orgId: string | null | undefined,
  branchId: string | null | undefined,
  category: string,
  apiCategories: string[] = []
): string[] {
  const trimmed = category.trim();
  if (!trimmed) {
    return readSavedExpenseCategories(orgId, branchId, apiCategories);
  }

  // Add to deleted list
  const delKey = scopedKey(DELETED_CATEGORIES_KEY, orgId, branchId);
  const currentDeleted = safeGetArray(delKey);
  if (!currentDeleted.some((d) => caseInsensitiveMatch(d, trimmed))) {
    safeSetArray(delKey, [...currentDeleted, trimmed]);
  }

  // Remove from custom list
  const customKey = scopedKey(CUSTOM_CATEGORIES_KEY, orgId, branchId);
  const currentCustom = safeGetArray(customKey);
  const nextCustom = currentCustom.filter((c) => !caseInsensitiveMatch(c, trimmed));
  safeSetArray(customKey, nextCustom);

  return readSavedExpenseCategories(orgId, branchId, apiCategories);
}

// ---------------------------------------------------------------------------
// Incurred By Presets
// ---------------------------------------------------------------------------

/**
 * Reads merged Incurred by presets: saved presets + seed names from recent records,
 * minus any names deleted by the user.
 */
export function readSavedIncurredByPresets(
  orgId: string | null | undefined,
  branchId: string | null | undefined,
  seedNames: string[] = []
): string[] {
  const presetsKey = scopedKey(INCURRED_BY_PRESETS_KEY, orgId, branchId);
  const delKey = scopedKey(DELETED_INCURRED_BY_KEY, orgId, branchId);

  let saved = safeGetArray(presetsKey);
  const deleted = safeGetArray(delKey);

  if (saved.length === 0) {
    saved = [...DEFAULT_INCURRED_BY_PRESETS];
  }

  const allMerged: string[] = [];
  const candidatePool = [...saved, ...seedNames];

  for (const item of candidatePool) {
    const trimmed = item?.trim();
    if (!trimmed) continue;
    const isDeleted = deleted.some((d) => caseInsensitiveMatch(d, trimmed));
    if (isDeleted) continue;
    const exists = allMerged.some((m) => caseInsensitiveMatch(m, trimmed));
    if (!exists) {
      allMerged.push(trimmed);
    }
  }

  return allMerged.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * Adds an Incurred by preset.
 */
export function addIncurredByPreset(
  orgId: string | null | undefined,
  branchId: string | null | undefined,
  name: string,
  seedNames: string[] = []
): string[] {
  const trimmed = name.trim();
  if (!trimmed) {
    return readSavedIncurredByPresets(orgId, branchId, seedNames);
  }

  // Remove from deleted list if present
  const delKey = scopedKey(DELETED_INCURRED_BY_KEY, orgId, branchId);
  const currentDeleted = safeGetArray(delKey);
  const nextDeleted = currentDeleted.filter((d) => !caseInsensitiveMatch(d, trimmed));
  if (nextDeleted.length !== currentDeleted.length) {
    safeSetArray(delKey, nextDeleted);
  }

  // Add to presets
  const presetsKey = scopedKey(INCURRED_BY_PRESETS_KEY, orgId, branchId);
  const currentPresets = safeGetArray(presetsKey);
  const baseList = currentPresets.length > 0 ? currentPresets : [...DEFAULT_INCURRED_BY_PRESETS];
  if (!baseList.some((p) => caseInsensitiveMatch(p, trimmed))) {
    safeSetArray(presetsKey, [...baseList, trimmed]);
  }

  return readSavedIncurredByPresets(orgId, branchId, seedNames);
}

/**
 * Removes an Incurred by preset so it no longer appears in suggestions.
 */
export function removeIncurredByPreset(
  orgId: string | null | undefined,
  branchId: string | null | undefined,
  name: string,
  seedNames: string[] = []
): string[] {
  const trimmed = name.trim();
  if (!trimmed) {
    return readSavedIncurredByPresets(orgId, branchId, seedNames);
  }

  // Add to deleted list
  const delKey = scopedKey(DELETED_INCURRED_BY_KEY, orgId, branchId);
  const currentDeleted = safeGetArray(delKey);
  if (!currentDeleted.some((d) => caseInsensitiveMatch(d, trimmed))) {
    safeSetArray(delKey, [...currentDeleted, trimmed]);
  }

  // Remove from presets
  const presetsKey = scopedKey(INCURRED_BY_PRESETS_KEY, orgId, branchId);
  const currentPresets = safeGetArray(presetsKey);
  const baseList = currentPresets.length > 0 ? currentPresets : [...DEFAULT_INCURRED_BY_PRESETS];
  const nextPresets = baseList.filter((p) => !caseInsensitiveMatch(p, trimmed));
  safeSetArray(presetsKey, nextPresets);

  return readSavedIncurredByPresets(orgId, branchId, seedNames);
}
