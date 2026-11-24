import { describe, it, expect, beforeEach } from "vitest";
import {
  getStoredMenuOrderCategory,
  setStoredMenuOrderCategory,
  clearStoredMenuOrderCategory,
} from "./menuOrderCategoryStorage";

describe("menuOrderCategoryStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("returns undefined when no category has been stored", () => {
    expect(getStoredMenuOrderCategory("org-1")).toBeUndefined();
    expect(getStoredMenuOrderCategory()).toBeUndefined();
  });

  it("stores and retrieves a specific category ID scoped by orgId", () => {
    setStoredMenuOrderCategory("cat-beer", "org-1");

    expect(getStoredMenuOrderCategory("org-1")).toBe("cat-beer");
    // Also returns via unscoped fallback
    expect(getStoredMenuOrderCategory(null)).toBe("cat-beer");
  });

  it("stores and retrieves null for 'All' category selection", () => {
    setStoredMenuOrderCategory(null, "org-1");

    expect(getStoredMenuOrderCategory("org-1")).toBeNull();
  });

  it("clears all stored menu order categories from both sessionStorage and localStorage", () => {
    setStoredMenuOrderCategory("cat-beer", "org-1");
    setStoredMenuOrderCategory("cat-spirits", "org-2");

    expect(getStoredMenuOrderCategory("org-1")).toBe("cat-beer");
    expect(getStoredMenuOrderCategory("org-2")).toBe("cat-spirits");

    clearStoredMenuOrderCategory();

    expect(getStoredMenuOrderCategory("org-1")).toBeUndefined();
    expect(getStoredMenuOrderCategory("org-2")).toBeUndefined();
  });
});
