/**
 * Utilities for global date input interaction:
 * 1. Shows the native calendar picker popup when clicking anywhere inside the input.
 * 2. Automatically closes the calendar popup (and removes residual segment focus)
 *    as soon as the user selects their desired date.
 */

const DATE_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

export function isDateInputElement(
  element: unknown
): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) {
    return false;
  }
  return (
    DATE_INPUT_TYPES.has(element.type) ||
    element.classList.contains("date-input")
  );
}

export function tryShowDatePicker(input: HTMLInputElement): void {
  if (input.disabled || input.readOnly) {
    return;
  }
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      // Ignored: already open, opening, unsupported, or dismissed.
    }
  }
}

/**
 * Initializes global event listeners across the document:
 * - Capture-phase `click`: triggers `showPicker()` when clicking anywhere in a date input.
 * - Bubble-phase `change`: calls `blur()` once a date is picked so the calendar popup closes.
 */
export function setupGlobalDatePicker(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (isDateInputElement(target)) {
      tryShowDatePicker(target);
    }
  };

  const handleChange = (event: Event) => {
    const target = event.target;
    if (isDateInputElement(target)) {
      // Blurring the input immediately dismisses and closes the native calendar popup.
      target.blur();
    }
  };

  document.addEventListener("click", handleClick, { capture: true });
  document.addEventListener("change", handleChange);

  return () => {
    document.removeEventListener("click", handleClick, { capture: true });
    document.removeEventListener("change", handleChange);
  };
}
