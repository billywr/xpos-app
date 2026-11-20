import { beforeEach, describe, expect, it } from "vitest";
import {
  readSavedExpenseCategories,
  addExpenseCategory,
  removeExpenseCategory,
  readSavedIncurredByPresets,
  addIncurredByPreset,
  removeIncurredByPreset,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCURRED_BY_PRESETS,
} from "./expensePresetsStorage";

describe("expensePresetsStorage", () => {
  const orgId = "org-test-1";
  const branchId = "branch-test-1";

  beforeEach(() => {
    localStorage.clear();
  });

  describe("Expense Categories (Spent on)", () => {
    it("returns default categories sorted alphabetically when nothing stored", () => {
      const result = readSavedExpenseCategories(orgId, branchId);
      expect(result).toEqual([...DEFAULT_EXPENSE_CATEGORIES].sort((a, b) => a.localeCompare(b)));
    });

    it("merges api categories into result", () => {
      const apiCategories = ["Custom API Category", "Fuel"];
      const result = readSavedExpenseCategories(orgId, branchId, apiCategories);
      expect(result).toContain("Custom API Category");
      expect(result).toContain("Fuel");
    });

    it("adds a custom category and persists it", () => {
      const updated = addExpenseCategory(orgId, branchId, "Office Stationery");
      expect(updated).toContain("Office Stationery");

      // Re-reading reflects the newly added category
      const readAgain = readSavedExpenseCategories(orgId, branchId);
      expect(readAgain).toContain("Office Stationery");
    });

    it("removes a category (including API categories) and excludes it on re-read", () => {
      const apiCategories = ["Dailly bills", "Fuel", "Bills"];
      let categories = readSavedExpenseCategories(orgId, branchId, apiCategories);
      expect(categories).toContain("Dailly bills");

      // Delete the typo "Dailly bills"
      categories = removeExpenseCategory(orgId, branchId, "Dailly bills", apiCategories);
      expect(categories).not.toContain("Dailly bills");
      expect(categories).toContain("Bills");
      expect(categories).toContain("Fuel");

      // Even if API returns it again, it remains excluded
      const reRead = readSavedExpenseCategories(orgId, branchId, apiCategories);
      expect(reRead).not.toContain("Dailly bills");
    });

    it("re-adding a deleted category un-deletes it", () => {
      removeExpenseCategory(orgId, branchId, "Fuel");
      expect(readSavedExpenseCategories(orgId, branchId)).not.toContain("Fuel");

      addExpenseCategory(orgId, branchId, "Fuel");
      expect(readSavedExpenseCategories(orgId, branchId)).toContain("Fuel");
    });
  });

  describe("Incurred By Presets", () => {
    it("returns default incurredBy presets when nothing is saved", () => {
      const presets = readSavedIncurredByPresets(orgId, branchId);
      expect(presets).toEqual([...DEFAULT_INCURRED_BY_PRESETS].sort((a, b) => a.localeCompare(b)));
    });

    it("merges seed names from existing records", () => {
      const seedNames = ["Alice Accountant", "Bob Driver"];
      const presets = readSavedIncurredByPresets(orgId, branchId, seedNames);
      expect(presets).toContain("Alice Accountant");
      expect(presets).toContain("Bob Driver");
    });

    it("adds an incurredBy preset and persists it", () => {
      const updated = addIncurredByPreset(orgId, branchId, "Charlie Guard");
      expect(updated).toContain("Charlie Guard");

      const readAgain = readSavedIncurredByPresets(orgId, branchId);
      expect(readAgain).toContain("Charlie Guard");
    });

    it("removes an incurredBy preset so it no longer appears in suggestions", () => {
      const seedNames = ["John Typo", "Jane Supervisor"];
      removeIncurredByPreset(orgId, branchId, "John Typo", seedNames);

      const presets = readSavedIncurredByPresets(orgId, branchId, seedNames);
      expect(presets).not.toContain("John Typo");
      expect(presets).toContain("Jane Supervisor");
    });
  });
});
