/**
 * Persists last-used app branding for display on login page.
 * Branding is org-scoped; we store the most recent org's branding for returning users.
 */
const KEY = "xpos_last_branding";

export interface StoredBranding {
  appName: string;
  logoDataUrl: string | null;
}

export function getStoredBranding(): StoredBranding | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBranding;
    if (parsed?.appName && typeof parsed.appName === "string") {
      return {
        appName: parsed.appName,
        logoDataUrl:
          parsed.logoDataUrl && typeof parsed.logoDataUrl === "string"
            ? parsed.logoDataUrl
            : null,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setStoredBranding(branding: StoredBranding): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(branding));
  } catch {
    /* ignore */
  }
}
