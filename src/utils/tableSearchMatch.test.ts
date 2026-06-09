import { describe, expect, it } from "vitest";
import {
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
