import { clearStoredMenuOrderCategory } from "@/utils/menuOrderCategoryStorage";

/**
 * Persist auth to sessionStorage so refresh keeps the user logged in (same tab).
 * Cleared on logout and when token is expired so we don't restore stale sessions.
 */

const AUTH_STORAGE_KEY = "xpos_auth";

export interface StoredAuth {
  token: string;
  iamUserId: string;
  username: string | null;
  expiresAt: number | null;
  refreshToken?: string | null;
  roles: string[];
}

/** Returns stored auth if present and not expired; otherwise clears storage and returns null. */
export function getStoredAuth(): StoredAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredAuth;
    if (!data.token || !data.iamUserId) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    // If we have an expiry, don't restore if expired (avoid flash of authenticated UI)
    if (data.expiresAt != null && data.expiresAt < Date.now()) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth): void {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(): void {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  clearStoredMenuOrderCategory();
}
