import { describe, it, expect } from "vitest";
import { ASSISTANT_SHOW_WIDGET, isAssistantWidgetVisible } from "./assistantVisibility";

describe("isAssistantWidgetVisible", () => {
  it("returns false when key is missing (default hidden)", () => {
    expect(isAssistantWidgetVisible({})).toBe(false);
  });

  it("returns false when key is explicitly false", () => {
    expect(isAssistantWidgetVisible({ [ASSISTANT_SHOW_WIDGET]: false })).toBe(false);
  });

  it("returns true when key is explicitly true", () => {
    expect(isAssistantWidgetVisible({ [ASSISTANT_SHOW_WIDGET]: true })).toBe(true);
  });
});
