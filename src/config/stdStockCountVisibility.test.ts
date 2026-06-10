import { describe, it, expect } from "vitest";
import {
  STD_STOCK_COUNT_SHOW_PDF,
  STD_STOCK_COUNT_SHOW_SAVE,
  STD_STOCK_COUNT_SHOW_RECONCILE,
  STD_STOCK_COUNT_SHOW_RECORD_SALES,
  isStdStockCountButtonVisible,
} from "./stdStockCountVisibility";

describe("isStdStockCountButtonVisible", () => {
  it("returns true when key is missing (default enabled)", () => {
    expect(isStdStockCountButtonVisible({}, STD_STOCK_COUNT_SHOW_PDF)).toBe(true);
    expect(isStdStockCountButtonVisible({}, STD_STOCK_COUNT_SHOW_SAVE)).toBe(true);
    expect(isStdStockCountButtonVisible({}, STD_STOCK_COUNT_SHOW_RECONCILE)).toBe(true);
    expect(isStdStockCountButtonVisible({}, STD_STOCK_COUNT_SHOW_RECORD_SALES)).toBe(true);
  });

  it("returns false when key is explicitly false", () => {
    const state = {
      [STD_STOCK_COUNT_SHOW_PDF]: false,
      [STD_STOCK_COUNT_SHOW_SAVE]: false,
    };
    expect(isStdStockCountButtonVisible(state, STD_STOCK_COUNT_SHOW_PDF)).toBe(false);
    expect(isStdStockCountButtonVisible(state, STD_STOCK_COUNT_SHOW_SAVE)).toBe(false);
  });

  it("returns true when key is explicitly true", () => {
    const state = { [STD_STOCK_COUNT_SHOW_RECORD_SALES]: true };
    expect(isStdStockCountButtonVisible(state, STD_STOCK_COUNT_SHOW_RECORD_SALES)).toBe(true);
  });
});
