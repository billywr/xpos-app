import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllStoredTablePageSize,
  getStoredTablePageSize,
  hasStoredTablePageSize,
  setStoredTablePageSize,
} from "./tablePaginationStorage";

describe("tablePaginationStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("returns fallbackSize when nothing is stored", () => {
    expect(getStoredTablePageSize("items", 15)).toBe(15);
    expect(getStoredTablePageSize(undefined, 25)).toBe(25);
    expect(hasStoredTablePageSize("items")).toBe(false);
    expect(hasStoredTablePageSize()).toBe(false);
  });

  it("persists table-specific and global page size across refresh", () => {
    setStoredTablePageSize(50, "items");

    expect(hasStoredTablePageSize("items")).toBe(true);
    expect(hasStoredTablePageSize("branches")).toBe(true); // Global exists
    expect(getStoredTablePageSize("items", 15)).toBe(50);
    // Another table without override falls back to global
    expect(getStoredTablePageSize("branches", 25)).toBe(50);
  });

  it("allows specific table override over global preference", () => {
    // User sets global preference first (or via another table)
    setStoredTablePageSize(20, "categories");
    // User sets specific table
    setStoredTablePageSize(10, "items");

    expect(getStoredTablePageSize("items", 25)).toBe(10);
    expect(getStoredTablePageSize("categories", 25)).toBe(20);
    expect(getStoredTablePageSize("other", 25)).toBe(10); // Global updated to last selected
  });

  it("respects and clamps to sizeOptions if provided", () => {
    setStoredTablePageSize(25, "custom");

    // Exact match in sizeOptions
    expect(getStoredTablePageSize("custom", 10, [10, 25, 50, 100])).toBe(25);

    // Closest match when stored size is not in options
    expect(getStoredTablePageSize("custom", 10, [10, 20, 50])).toBe(20);
  });

  it("clears all stored sizes upon logout", () => {
    setStoredTablePageSize(10, "std-stock-count");
    setStoredTablePageSize(50, "inventory");

    expect(getStoredTablePageSize("std-stock-count", 15)).toBe(10);
    expect(getStoredTablePageSize("inventory", 20)).toBe(50);
    expect(hasStoredTablePageSize("std-stock-count")).toBe(true);

    clearAllStoredTablePageSize();

    expect(hasStoredTablePageSize("std-stock-count")).toBe(false);
    expect(hasStoredTablePageSize("inventory")).toBe(false);
    expect(getStoredTablePageSize("std-stock-count", 15)).toBe(15);
    expect(getStoredTablePageSize("inventory", 20)).toBe(20);
  });
});
