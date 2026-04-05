import { getEnv } from "@/utils/env";

const DEFAULT_MINUTES = 5;

/**
 * Idle auto-logout duration from VITE_IDLE_LOGOUT_MINUTES (minutes).
 * Missing or invalid values (non-finite or not positive) fall back to the default (5 minutes).
 */
export function getIdleLogoutMs(): number {
  const raw = getEnv("VITE_IDLE_LOGOUT_MINUTES");
  if (raw === undefined || raw === "") {
    return DEFAULT_MINUTES * 60_000;
  }
  const mins = Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(mins) || mins <= 0) {
    return DEFAULT_MINUTES * 60_000;
  }
  return Math.round(mins * 60_000);
}
