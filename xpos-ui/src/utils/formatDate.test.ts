import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatDateInput } from "./formatDate";

describe("formatDate", () => {
  it("formats ISO date string (YYYY-MM-DD) into dd/mm/yyyy without timezone shift", () => {
    expect(formatDate("2026-12-17")).toBe("17/12/2026");
    expect(formatDate("2024-02-29")).toBe("29/02/2024");
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });

  it("formats ISO timestamp strings", () => {
    // 2026-12-17T12:00:00Z
    const d = new Date("2026-12-17T12:00:00Z");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    expect(formatDate("2026-12-17T12:00:00Z")).toBe(`${day}/${month}/${year}`);
  });

  it("formats Date instances", () => {
    const d = new Date(2026, 11, 17); // Month 11 is December
    expect(formatDate(d)).toBe("17/12/2026");
  });

  it("handles empty or invalid inputs gracefully", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("invalid-date", "N/A")).toBe("N/A");
  });
});

describe("formatDateTime", () => {
  it("formats timestamp into dd/mm/yyyy, HH:mm", () => {
    const d = new Date(2026, 11, 17, 14, 30);
    expect(formatDateTime(d)).toBe("17/12/2026, 14:30");
  });

  it("includes seconds when requested", () => {
    const d = new Date(2026, 11, 17, 14, 30, 45);
    expect(formatDateTime(d, { includeSeconds: true })).toBe("17/12/2026, 14:30:45");
  });

  it("handles null or undefined gracefully", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined, { fallback: "Empty" })).toBe("Empty");
  });
});

describe("formatDateInput", () => {
  it("returns YYYY-MM-DD from Date objects or ISO strings", () => {
    expect(formatDateInput("2026-12-17")).toBe("2026-12-17");
    const d = new Date(2026, 11, 17);
    expect(formatDateInput(d)).toBe("2026-12-17");
  });

  it("returns empty string on null or invalid", () => {
    expect(formatDateInput(null)).toBe("");
    expect(formatDateInput("invalid")).toBe("");
  });
});
