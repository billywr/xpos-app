import { describe, expect, it } from "vitest";
import { sortTableRows } from "./tableSort";

type Row = { name: string; qty: number; receivedAt: string };

const rows: Row[] = [
  { name: "K.C 250ml", qty: 4.5, receivedAt: "2026-04-05T08:25:00Z" },
  { name: "Water", qty: 10, receivedAt: "2026-04-06T08:25:00Z" },
  { name: "Apple", qty: 2, receivedAt: "2026-04-04T08:25:00Z" },
];

const getSortValue = (row: Row, column: string) => {
  if (column === "name") return row.name;
  if (column === "qty") return row.qty;
  if (column === "receivedAt") return row.receivedAt;
  return null;
};

describe("sortTableRows", () => {
  it("sorts strings ascending with locale-aware order", () => {
    const sorted = sortTableRows(
      rows,
      { column: "name", direction: "asc" },
      getSortValue
    );
    expect(sorted.map((r) => r.name)).toEqual(["Apple", "K.C 250ml", "Water"]);
  });

  it("sorts numbers descending", () => {
    const sorted = sortTableRows(
      rows,
      { column: "qty", direction: "desc" },
      getSortValue
    );
    expect(sorted.map((r) => r.qty)).toEqual([10, 4.5, 2]);
  });

  it("sorts ISO dates ascending", () => {
    const sorted = sortTableRows(
      rows,
      { column: "receivedAt", direction: "asc" },
      getSortValue
    );
    expect(sorted.map((r) => r.name)).toEqual(["Apple", "K.C 250ml", "Water"]);
  });

  it("returns original order when no sort column", () => {
    expect(
      sortTableRows(rows, { column: null, direction: "asc" }, getSortValue)
    ).toEqual(rows);
  });

});
