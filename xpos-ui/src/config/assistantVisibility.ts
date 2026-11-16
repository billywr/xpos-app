/**
 * Operator visibility key for the XPOS Assistant floating button.
 * When value is true, the widget is shown. When false or key is missing, hidden.
 */
export const ASSISTANT_SHOW_WIDGET = "assistant.showWidget";

export function isAssistantWidgetVisible(
  visibilityState: Record<string, boolean>
): boolean {
  return visibilityState[ASSISTANT_SHOW_WIDGET] === true;
}
