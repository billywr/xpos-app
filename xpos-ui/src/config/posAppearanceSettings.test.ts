import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  POS_EXPANDED_DEFAULT_KEY,
  isPosExpandedByDefault,
  setPosExpandedByDefault,
} from "./posAppearanceSettings";

describe("posAppearanceSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("defaults to true when no label or localStorage is present", () => {
    expect(isPosExpandedByDefault()).toBe(true);
    expect(isPosExpandedByDefault({})).toBe(true);
  });

  it("respects org admin labels when provided", () => {
    expect(
      isPosExpandedByDefault({ [POS_EXPANDED_DEFAULT_KEY]: "false" })
    ).toBe(false);
    expect(
      isPosExpandedByDefault({ [POS_EXPANDED_DEFAULT_KEY]: "true" })
    ).toBe(true);
  });

  it("falls back to localStorage when label is not provided", () => {
    localStorage.setItem(POS_EXPANDED_DEFAULT_KEY, "false");
    expect(isPosExpandedByDefault()).toBe(false);

    localStorage.setItem(POS_EXPANDED_DEFAULT_KEY, "true");
    expect(isPosExpandedByDefault()).toBe(true);
  });

  it("sets preference in localStorage and invokes setAdminLabel", () => {
    const mockSetAdminLabel = vi.fn();
    setPosExpandedByDefault(false, mockSetAdminLabel);

    expect(localStorage.getItem(POS_EXPANDED_DEFAULT_KEY)).toBe("false");
    expect(mockSetAdminLabel).toHaveBeenCalledWith(
      POS_EXPANDED_DEFAULT_KEY,
      "false"
    );
  });

  it("dispatches custom event on change", () => {
    const listener = vi.fn();
    window.addEventListener("pos-expanded-default-changed", listener);

    setPosExpandedByDefault(true);

    expect(listener).toHaveBeenCalled();
    window.removeEventListener("pos-expanded-default-changed", listener);
  });
});
