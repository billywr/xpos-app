/**
 * Configuration and persistence for Toast notification preferences.
 */

export const TOAST_SHOW_TIME_KEY = "ui.toast.show_time";

/**
 * Checks whether execution time (ms / s) should be shown in toast notifications.
 * Defaults to true.
 * First checks org admin labels, then falls back to localStorage.
 */
export function isToastTimeVisible(
  labels?: Record<string, string> | null
): boolean {
  if (labels && labels[TOAST_SHOW_TIME_KEY] !== undefined) {
    return labels[TOAST_SHOW_TIME_KEY] !== "false";
  }
  try {
    const stored = localStorage.getItem(TOAST_SHOW_TIME_KEY);
    if (stored !== null) {
      return stored !== "false";
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return true;
}

/**
 * Saves the toast time visibility preference to localStorage and org admin labels (if provided),
 * and dispatches a cross-component event so active ToastProvider updates immediately.
 */
export function setToastTimeVisible(
  visible: boolean,
  setAdminLabel?: (key: string, value: string) => void
): void {
  try {
    localStorage.setItem(TOAST_SHOW_TIME_KEY, String(visible));
  } catch {
    // Ignore storage errors in restricted contexts
  }
  window.dispatchEvent(
    new CustomEvent("toast-time-visibility-changed", { detail: { visible } })
  );
  if (setAdminLabel) {
    setAdminLabel(TOAST_SHOW_TIME_KEY, String(visible));
  }
}
