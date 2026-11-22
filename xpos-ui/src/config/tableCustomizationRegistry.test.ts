import { describe, it, expect } from "vitest";
import {
  TABLE_REGISTRY,
  TABLE_LIST,
  TABLE_CATEGORIES,
} from "./tableCustomizationRegistry";

describe("tableCustomizationRegistry", () => {
  it("defines unique table keys matching their id", () => {
    for (const [key, def] of Object.entries(TABLE_REGISTRY)) {
      expect(def.id).toBe(key);
      expect(def.title).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(TABLE_CATEGORIES).toContain(def.category);
    }
  });

  it("ensures each table has non-empty columns with valid orders and unique keys", () => {
    for (const def of TABLE_LIST) {
      expect(def.columns.length).toBeGreaterThan(0);

      const keys = new Set<string>();
      const orders = new Set<number>();

      for (const col of def.columns) {
        expect(col.key).toBeTruthy();
        expect(col.defaultLabel).toBeTruthy();
        expect(col.defaultOrder).toBeGreaterThan(0);

        // Check for duplicates within table
        expect(keys.has(col.key)).toBe(false);
        keys.add(col.key);

        expect(orders.has(col.defaultOrder)).toBe(false);
        orders.add(col.defaultOrder);
      }
    }
  });

  it("ensures all tables provide realistic sample data matching their columns", () => {
    for (const def of TABLE_LIST) {
      expect(Array.isArray(def.sampleData)).toBe(true);
      expect(def.sampleData!.length).toBeGreaterThan(0);
    }
  });

  it("contains all expected primary datatables", () => {
    const tableIds = Object.keys(TABLE_REGISTRY);
    expect(tableIds).toContain("items");
    expect(tableIds).toContain("categories");
    expect(tableIds).toContain("sales");
    expect(tableIds).toContain("receipts");
    expect(tableIds).toContain("shifts");
    expect(tableIds).toContain("z-reports");
    expect(tableIds).toContain("inventory");
    expect(tableIds).toContain("stock-receipt");
    expect(tableIds).toContain("std-stock-count");
    expect(tableIds).toContain("suppliers");
    expect(tableIds).toContain("customer-debts");
    expect(tableIds).toContain("misc-expenses");
    expect(tableIds).toContain("staff");
  });
});
