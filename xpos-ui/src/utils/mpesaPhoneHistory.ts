const STORAGE_PREFIX = "xpos_mpesa_stk_phones";
const MAX_RECENT = 8;

function storageKey(orgId: string, branchId: string): string {
  return `${STORAGE_PREFIX}:${orgId}:${branchId}`;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

function readAll(orgId: string, branchId: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(storageKey(orgId, branchId));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map(normalizePhone)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeAll(orgId: string, branchId: string, phones: string[]): void {
  localStorage.setItem(storageKey(orgId, branchId), JSON.stringify(phones.slice(0, MAX_RECENT)));
}

/** Most recently used STK phone for this org/branch, if any. */
export function getLastMpesaStkPhone(orgId: string, branchId: string): string | null {
  const phones = readAll(orgId, branchId);
  return phones[0] ?? null;
}

/** Recent STK phones (newest first), optionally filtered by partial input. */
export function getMpesaStkPhoneSuggestions(
  orgId: string,
  branchId: string,
  query = ""
): string[] {
  const phones = readAll(orgId, branchId);
  const q = normalizePhone(query).toLowerCase();
  if (!q) {
    return phones;
  }
  return phones.filter((phone) => phone.toLowerCase().includes(q));
}

/** Save phone after a successful STK initiate (moves to front, dedupes). */
export function rememberMpesaStkPhone(
  orgId: string,
  branchId: string,
  phone: string
): void {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return;
  }
  const existing = readAll(orgId, branchId).filter((p) => p !== normalized);
  writeAll(orgId, branchId, [normalized, ...existing]);
}
