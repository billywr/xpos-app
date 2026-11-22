/**
 * Configuration and persistence for POS appearance and layout preferences.
 */

export const POS_EXPANDED_DEFAULT_KEY = "ui.pos.expanded_default";

/**
 * Checks whether the POS interface should open expanded (fullscreen mode) by default.
 * Defaults to true.
 * First checks org admin labels, then falls back to localStorage.
 */
export function isPosExpandedByDefault(
  labels?: Record<string, string> | null
): boolean {
  if (labels && labels[POS_EXPANDED_DEFAULT_KEY] !== undefined) {
    return labels[POS_EXPANDED_DEFAULT_KEY] !== "false";
  }
  try {
    const stored = localStorage.getItem(POS_EXPANDED_DEFAULT_KEY);
    if (stored !== null) {
      return stored !== "false";
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return true;
}

/**
 * Saves the POS expanded default preference to localStorage and org admin labels (if provided),
 * and dispatches a cross-component event so active listeners update immediately.
 */
export function setPosExpandedByDefault(
  expanded: boolean,
  setAdminLabel?: (key: string, value: string) => void
): void {
  try {
    localStorage.setItem(POS_EXPANDED_DEFAULT_KEY, String(expanded));
  } catch {
    // Ignore storage errors in restricted contexts
  }
  window.dispatchEvent(
    new CustomEvent("pos-expanded-default-changed", { detail: { expanded } })
  );
  if (setAdminLabel) {
    setAdminLabel(POS_EXPANDED_DEFAULT_KEY, String(expanded));
  }
}
