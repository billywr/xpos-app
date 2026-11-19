import { describe, it, expect, beforeEach } from "vitest";
import {
  getSavedStockCountDate,
  saveStockCountDate,
  getSavedGoodsReceiptReceivedAt,
  saveGoodsReceiptReceivedAt,
  getSavedGoodsReceiptFilterRange,
  saveGoodsReceiptFilterRange,
  clearAllStoredDatePersistence,
} from "./datePersistenceStorage";

describe("datePersistenceStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("clearAllStoredDatePersistence", () => {
    it("clears all stock count and goods receipt persisted dates but leaves unrelated items intact", () => {
      saveStockCountDate("2026-11-10", "org-1", "branch-1");
      saveGoodsReceiptReceivedAt("2026-11-10T14:30", "org-1", "branch-1");
      saveGoodsReceiptFilterRange({ preset: "7days", startDate: "", endDate: "" }, "org-1", "branch-1");
      localStorage.setItem("unrelated_theme", "dark");

      clearAllStoredDatePersistence();

      expect(getSavedStockCountDate("org-1", "branch-1")).toBeNull();
      expect(getSavedGoodsReceiptReceivedAt("org-1", "branch-1")).toBeNull();
      expect(getSavedGoodsReceiptFilterRange("org-1", "branch-1")).toEqual({ preset: null, startDate: null, endDate: null });
      expect(localStorage.getItem("unrelated_theme")).toBe("dark");
    });
  });

  describe("Stock Count Date", () => {
    it("returns null when no date is stored", () => {
      expect(getSavedStockCountDate("org-1", "branch-1")).toBeNull();
    });

    it("saves and retrieves scoped date for org and branch", () => {
      saveStockCountDate("2026-11-10", "org-1", "branch-1");
      expect(getSavedStockCountDate("org-1", "branch-1")).toBe("2026-11-10");
    });

    it("falls back to global date if scoped date does not exist", () => {
      saveStockCountDate("2026-11-12");
      expect(getSavedStockCountDate("other-org", "other-branch")).toBe("2026-11-12");
    });

    it("ignores invalid date formats", () => {
      saveStockCountDate("invalid-date", "org-1", "branch-1");
      expect(getSavedStockCountDate("org-1", "branch-1")).toBeNull();
    });
  });

  describe("Goods Receipt Received At", () => {
    it("returns null when nothing is stored", () => {
      expect(getSavedGoodsReceiptReceivedAt("org-1", "branch-1")).toBeNull();
    });

    it("saves and retrieves scoped receivedAt datetime", () => {
      const dt = "2026-11-10T14:30";
      saveGoodsReceiptReceivedAt(dt, "org-1", "branch-1");
      expect(getSavedGoodsReceiptReceivedAt("org-1", "branch-1")).toBe(dt);
    });

    it("falls back to global receivedAt if scoped does not exist", () => {
      const dt = "2026-11-09T09:15";
      saveGoodsReceiptReceivedAt(dt);
      expect(getSavedGoodsReceiptReceivedAt("other-org", "other-branch")).toBe(dt);
    });
  });

  describe("Goods Receipt Filter Range", () => {
    it("returns empty object when nothing stored", () => {
      const result = getSavedGoodsReceiptFilterRange("org-1", "branch-1");
      expect(result).toEqual({ preset: null, startDate: null, endDate: null });
    });

    it("saves and retrieves filter range", () => {
      const filter = { preset: "custom", startDate: "2026-11-01", endDate: "2026-11-10" };
      saveGoodsReceiptFilterRange(filter, "org-1", "branch-1");
      expect(getSavedGoodsReceiptFilterRange("org-1", "branch-1")).toEqual(filter);
    });
  });
});
