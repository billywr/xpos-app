/**
 * Configuration and persistence for POS appearance and layout preferences.
 */

export const POS_EXPANDED_DEFAULT_KEY = "ui.pos.expanded_default";
export const POS_LAYOUT_KEY = "ui.pos.layout";

export type PosLayoutOption = "standard" | "vertical-category";

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

/**
 * Gets the configured POS layout option.
 * Defaults to "standard" (horizontal categories on top).
 * First checks org admin labels, then falls back to localStorage.
 */
export function getPosLayout(
  labels?: Record<string, string> | null
): PosLayoutOption {
  if (labels && labels[POS_LAYOUT_KEY] !== undefined) {
    const val = labels[POS_LAYOUT_KEY];
    if (val === "vertical-category" || val === "standard") {
      return val;
    }
  }
  try {
    const stored = localStorage.getItem(POS_LAYOUT_KEY);
    if (stored === "vertical-category" || stored === "standard") {
      return stored;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return "standard";
}

/**
 * Saves the POS layout preference to localStorage and org admin labels (if provided),
 * and dispatches a cross-component event so active listeners update immediately.
 */
export function setPosLayout(
  layout: PosLayoutOption,
  setAdminLabel?: (key: string, value: string) => void
): void {
  try {
    localStorage.setItem(POS_LAYOUT_KEY, layout);
  } catch {
    // Ignore storage errors in restricted contexts
  }
  window.dispatchEvent(
    new CustomEvent("pos-layout-changed", { detail: { layout } })
  );
  if (setAdminLabel) {
    setAdminLabel(POS_LAYOUT_KEY, layout);
  }
}

export const POS_VERTICAL_CATEGORY_CARD_KEY = "ui.pos.vertical_category_card";

/**
 * Checks whether the vertical category menu should display an enclosing card
 * (background, border, shadow) and the "Categories" title.
 * Defaults to true.
 * First checks org admin labels, then falls back to localStorage.
 */
export function isPosVerticalCategoryCardVisible(
  labels?: Record<string, string> | null
): boolean {
  if (labels && labels[POS_VERTICAL_CATEGORY_CARD_KEY] !== undefined) {
    return labels[POS_VERTICAL_CATEGORY_CARD_KEY] !== "false";
  }
  try {
    const stored = localStorage.getItem(POS_VERTICAL_CATEGORY_CARD_KEY);
    if (stored !== null) {
      return stored !== "false";
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return true;
}

/**
 * Saves the vertical category card preference to localStorage and org admin labels (if provided),
 * and dispatches a cross-component event so active listeners update immediately.
 */
export function setPosVerticalCategoryCardVisible(
  visible: boolean,
  setAdminLabel?: (key: string, value: string) => void
): void {
  try {
    localStorage.setItem(POS_VERTICAL_CATEGORY_CARD_KEY, String(visible));
  } catch {
    // Ignore storage errors in restricted contexts
  }
  window.dispatchEvent(
    new CustomEvent("pos-vertical-category-card-changed", { detail: { visible } })
  );
  if (setAdminLabel) {
    setAdminLabel(POS_VERTICAL_CATEGORY_CARD_KEY, String(visible));
  }
}

export const POS_SELECTED_CATEGORY_LABEL_KEY = "ui.pos.selected_category_label";

/**
 * Checks whether the selected category indicator pill should be displayed
 * above the product grid in Zone 2.
 * Defaults to true.
 * First checks org admin labels, then falls back to localStorage.
 */
export function isPosSelectedCategoryLabelVisible(
  labels?: Record<string, string> | null
): boolean {
  if (labels && labels[POS_SELECTED_CATEGORY_LABEL_KEY] !== undefined) {
    return labels[POS_SELECTED_CATEGORY_LABEL_KEY] !== "false";
  }
  try {
    const stored = localStorage.getItem(POS_SELECTED_CATEGORY_LABEL_KEY);
    if (stored !== null) {
      return stored !== "false";
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return true;
}

/**
 * Saves the selected category label visibility preference to localStorage and org admin labels (if provided),
 * and dispatches a cross-component event so active listeners update immediately.
 */
export function setPosSelectedCategoryLabelVisible(
  visible: boolean,
  setAdminLabel?: (key: string, value: string) => void
): void {
  try {
    localStorage.setItem(POS_SELECTED_CATEGORY_LABEL_KEY, String(visible));
  } catch {
    // Ignore storage errors in restricted contexts
  }
  window.dispatchEvent(
    new CustomEvent("pos-selected-category-label-changed", { detail: { visible } })
  );
  if (setAdminLabel) {
    setAdminLabel(POS_SELECTED_CATEGORY_LABEL_KEY, String(visible));
  }
}

