import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_UTILITY_PRESETS = [
  "Rent",
  "Electricity (KPLC)",
  "Water Bill",
  "Internet / WiFi",
  "DSTV / TV Subscription",
  "Waste / Garbage Collection",
  "Security / Guard Service",
  "County Single Business Permit",
  "Salaries / Wages",
  "Equipment Maintenance",
  "Cleaning Services",
  "Other",
];

const KEY_PREFIX = "@xpos:utility_presets";

function storageKey(orgId: string, branchId: string): string {
  return `${KEY_PREFIX}:${orgId}:${branchId}`;
}

/**
 * Read the list of utility presets for the given organization and branch.
 * If none exist yet in AsyncStorage, initializes and persists DEFAULT_UTILITY_PRESETS.
 */
export async function readSavedUtilityPresets(
  orgId: string,
  branchId: string,
  extraSeedNames: string[] = []
): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(orgId, branchId));
    if (!raw) {
      const merged = [...DEFAULT_UTILITY_PRESETS];
      for (const extra of extraSeedNames) {
        const trimmed = extra?.trim();
        if (
          trimmed &&
          !merged.some((p) => p.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0)
        ) {
          merged.push(trimmed);
        }
      }
      await saveUtilityPresets(orgId, branchId, merged);
      return merged;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_UTILITY_PRESETS];
    }
    const filtered = parsed.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
    );
    return filtered.length > 0 ? filtered : [...DEFAULT_UTILITY_PRESETS];
  } catch {
    return [...DEFAULT_UTILITY_PRESETS];
  }
}

/**
 * Persist the utility presets list to AsyncStorage.
 */
export async function saveUtilityPresets(
  orgId: string,
  branchId: string,
  presets: string[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(orgId, branchId), JSON.stringify(presets));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Add a new preset to the saved list if not already present.
 */
export async function addUtilityPreset(
  orgId: string,
  branchId: string,
  name: string
): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) {
    return readSavedUtilityPresets(orgId, branchId);
  }
  const current = await readSavedUtilityPresets(orgId, branchId);
  const exists = current.some(
    (p) => p.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0
  );
  if (exists) {
    return current;
  }
  const updated = [...current, trimmed];
  await saveUtilityPresets(orgId, branchId, updated);
  return updated;
}

/**
 * Remove a preset from the saved list.
 */
export async function removeUtilityPreset(
  orgId: string,
  branchId: string,
  name: string
): Promise<string[]> {
  const trimmed = name.trim();
  const current = await readSavedUtilityPresets(orgId, branchId);
  const updated = current.filter(
    (p) => p.localeCompare(trimmed, undefined, { sensitivity: "base" }) !== 0
  );
  await saveUtilityPresets(orgId, branchId, updated);
  return updated;
}
