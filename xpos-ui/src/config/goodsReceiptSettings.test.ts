import { describe, it, expect } from "vitest";
import {
  getStockReceiptMaxQty,
  isStockReceiptDigitsOnly,
  isStockReceiptShowLimit,
  sanitizeStockReceiptQty,
  DEFAULT_STOCK_RECEIPT_MAX_QTY,
  STOCK_RECEIPT_MAX_QTY_KEY,
  STOCK_RECEIPT_DIGITS_ONLY_KEY,
  STOCK_RECEIPT_SHOW_LIMIT_KEY,
  STOCK_RECEIPT_QTY_PRESETS,
} from "./goodsReceiptSettings";

describe("goodsReceiptSettings", () => {
  describe("getStockReceiptMaxQty", () => {
    it("returns default 99 when labels are undefined or key is not set", () => {
      expect(getStockReceiptMaxQty(undefined)).toBe(DEFAULT_STOCK_RECEIPT_MAX_QTY);
      expect(getStockReceiptMaxQty({})).toBe(99);
    });

    it("parses valid positive integer from labels", () => {
      expect(
        getStockReceiptMaxQty({ [STOCK_RECEIPT_MAX_QTY_KEY]: "100" })
      ).toBe(100);
      expect(
        getStockReceiptMaxQty({ [STOCK_RECEIPT_MAX_QTY_KEY]: "200" })
      ).toBe(200);
      expect(
        getStockReceiptMaxQty({ [STOCK_RECEIPT_MAX_QTY_KEY]: "500" })
      ).toBe(500);
    });

    it("falls back to default 99 if value is 0, negative, or invalid", () => {
      expect(
        getStockReceiptMaxQty({ [STOCK_RECEIPT_MAX_QTY_KEY]: "0" })
      ).toBe(99);
      expect(
        getStockReceiptMaxQty({ [STOCK_RECEIPT_MAX_QTY_KEY]: "-5" })
      ).toBe(99);
      expect(
        getStockReceiptMaxQty({ [STOCK_RECEIPT_MAX_QTY_KEY]: "abc" })
      ).toBe(99);
    });
  });

  describe("isStockReceiptDigitsOnly", () => {
    it("defaults to true when unset or undefined", () => {
      expect(isStockReceiptDigitsOnly(undefined)).toBe(true);
      expect(isStockReceiptDigitsOnly({})).toBe(true);
      expect(
        isStockReceiptDigitsOnly({ [STOCK_RECEIPT_DIGITS_ONLY_KEY]: "true" })
      ).toBe(true);
    });

    it("returns false only when explicitly set to 'false'", () => {
      expect(
        isStockReceiptDigitsOnly({ [STOCK_RECEIPT_DIGITS_ONLY_KEY]: "false" })
      ).toBe(false);
    });
  });

  describe("isStockReceiptShowLimit", () => {
    it("defaults to false when unset or undefined", () => {
      expect(isStockReceiptShowLimit(undefined)).toBe(false);
      expect(isStockReceiptShowLimit({})).toBe(false);
      expect(
        isStockReceiptShowLimit({ [STOCK_RECEIPT_SHOW_LIMIT_KEY]: "" })
      ).toBe(false);
    });

    it("returns true only when explicitly set to 'true'", () => {
      expect(
        isStockReceiptShowLimit({ [STOCK_RECEIPT_SHOW_LIMIT_KEY]: "true" })
      ).toBe(true);
      expect(
        isStockReceiptShowLimit({ [STOCK_RECEIPT_SHOW_LIMIT_KEY]: "false" })
      ).toBe(false);
    });
  });

  describe("sanitizeStockReceiptQty", () => {
    it("strips non-digits when digitsOnly is true", () => {
      expect(sanitizeStockReceiptQty("12a3", 200, true)).toBe("123");
      expect(sanitizeStockReceiptQty("-15", 99, true)).toBe("15");
      expect(sanitizeStockReceiptQty("e12", 99, true)).toBe("12");
    });

    it("flips back to maxQty when typed value exceeds maxQty", () => {
      // For max 99
      expect(sanitizeStockReceiptQty("100", 99, true)).toBe("99");
      expect(sanitizeStockReceiptQty("10000", 99, true)).toBe("99");
      expect(sanitizeStockReceiptQty("8788", 99, true)).toBe("99");

      // For max 200
      expect(sanitizeStockReceiptQty("250", 200, true)).toBe("200");
      expect(sanitizeStockReceiptQty("8788", 200, true)).toBe("200");

      // For max 1000 (flips to formatted 1,000)
      expect(sanitizeStockReceiptQty("8788", 1000, true)).toBe("1,000");
      expect(sanitizeStockReceiptQty("1500", 1000, true)).toBe("1,000");
    });

    it("formats numbers with comma separators", () => {
      expect(sanitizeStockReceiptQty("1000", 1000, true)).toBe("1,000");
      expect(sanitizeStockReceiptQty("5000", 10000, true)).toBe("5,000");
      expect(sanitizeStockReceiptQty("1250", 5000, true)).toBe("1,250");
      expect(sanitizeStockReceiptQty("45", 99, true)).toBe("45");
      expect(sanitizeStockReceiptQty("7", 99, true)).toBe("7");
    });

    it("handles decimal quantities and comma separators when digitsOnly is false", () => {
      expect(sanitizeStockReceiptQty("12.", 100, false)).toBe("12.");
      expect(sanitizeStockReceiptQty("12.5", 100, false)).toBe("12.5");
      expect(sanitizeStockReceiptQty("1000.5", 5000, false)).toBe("1,000.5");
      expect(sanitizeStockReceiptQty("1500", 1000, false)).toBe("1,000");
      expect(sanitizeStockReceiptQty("1000.5", 1000, false)).toBe("1,000");
    });

    it("handles empty or blank input gracefully", () => {
      expect(sanitizeStockReceiptQty("", 99, true)).toBe("");
    });
  });

  describe("presets", () => {
    it("includes standard presets: 99 (2 digits), 100, 200, 500, 1000", () => {
      const values = STOCK_RECEIPT_QTY_PRESETS.map((p) => p.value);
      expect(values).toContain(99);
      expect(values).toContain(100);
      expect(values).toContain(200);
      expect(values).toContain(500);
      expect(values).toContain(1000);
    });
  });
});
