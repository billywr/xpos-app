import { describe, expect, it } from "vitest";
import {
  buildDefaultSearchableText,
  filterRowsBySearch,
  matchesSearchQuery,
  normalizeSearchText,
  rowMatchesSearch,
} from "./tableSearchMatch";

describe("tableSearchMatch", () => {
  describe("normalizeSearchText", () => {
    it("strips punctuation so kc matches K.C", () => {
      expect(normalizeSearchText("K.C 250ml")).toBe("kc250ml");
      expect(normalizeSearchText("kc")).toBe("kc");
    });
  });

  describe("matchesSearchQuery", () => {
    it("matches kc against K.C 250ml", () => {
      expect(matchesSearchQuery("K.C 250ml", "kc")).toBe(true);
    });

    it("matches numeric qty fragments", () => {
      expect(matchesSearchQuery("4.5", "4.5")).toBe(true);
      expect(matchesSearchQuery("qty 4.5 bottles", "45")).toBe(true);
    });

    it("returns true for empty query", () => {
      expect(matchesSearchQuery("anything", "")).toBe(true);
      expect(matchesSearchQuery("anything", "   ")).toBe(true);
    });
  });

  describe("filterRowsBySearch", () => {
    const rows = [
      { name: "K.C 250ml", qty: 4.5 },
      { name: "Water 500ml", qty: 10 },
    ];

    it("finds rows across normalized name match", () => {
      expect(filterRowsBySearch(rows, "kc")).toHaveLength(1);
      expect(filterRowsBySearch(rows, "kc")[0]?.name).toBe("K.C 250ml");
    });

    it("searches numeric columns", () => {
      expect(filterRowsBySearch(rows, "4.5")).toHaveLength(1);
    });

    it("searches nested object fields", () => {
      const nested = [
        { orgId: "uuid-1", branch: { name: "Stone Pub" } },
        { orgId: "uuid-2", branch: { name: "Downtown" } },
      ];
      expect(filterRowsBySearch(nested, "stone")).toHaveLength(1);
      expect(filterRowsBySearch(nested, "uuid-1")).toHaveLength(0);
    });
  });

  describe("buildDefaultSearchableText", () => {
    it("includes sort accessor values not present as top-level primitives", () => {
      const row = { id: "x", amount: 100 };
      const accessors = {
        label: () => "Outstanding KES",
        displayAmount: () => "KES 1,400.00",
      };
      const haystack = buildDefaultSearchableText(row, accessors);
      expect(haystack).toContain("Outstanding KES");
      expect(haystack).toContain("KES 1,400.00");
      expect(haystack).toContain("100");
    });

    it("matches query via accessor-only display text", () => {
      const row = { id: "abc" };
      const accessors = { customer: () => "Jane Doe" };
      expect(rowMatchesSearch(row, "jane", undefined, accessors)).toBe(true);
    });
  });

  describe("rowMatchesSearch with custom getter", () => {
    it("uses getSearchableText when provided", () => {
      const row = { a: 1, b: 2 };
      expect(
        rowMatchesSearch(row, "custom", () => "custom field value")
      ).toBe(true);
      expect(rowMatchesSearch(row, "missing", () => "custom field value")).toBe(
        false
      );
    });
  });
});
