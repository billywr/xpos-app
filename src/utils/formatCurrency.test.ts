import { describe, it, expect } from "vitest";
import { formatCurrency, formatAmount, formatPercent } from "./formatCurrency";

describe("formatCurrency", () => {
  it("formats positive amount as KES", () => {
    expect(formatCurrency(100)).toMatch(/100/);
    expect(formatCurrency(100)).toMatch(/KES|KSh|K/);
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toMatch(/0/);
  });

  it("formats decimal amount", () => {
    const s = formatCurrency(56.37);
    expect(s).toMatch(/56/);
    expect(s).toMatch(/37|\.37/);
  });

  it("accepts currency override", () => {
    const s = formatCurrency(10, "USD");
    expect(s).toMatch(/10/);
  });

  it("handles null, undefined, NaN safely", () => {
    expect(formatCurrency(null)).toMatch(/0\.00|0/);
    expect(formatCurrency(undefined)).toMatch(/0\.00|0/);
    expect(formatCurrency(Number.NaN)).toMatch(/0\.00|0/);
  });
});

describe("formatAmount", () => {
  it("formats amount strictly with 2 decimal places", () => {
    expect(formatAmount(100)).toBe("100.00");
    expect(formatAmount(100.5)).toBe("100.50");
    expect(formatAmount(100.567)).toBe("100.57");
  });

  it("handles null, undefined, NaN safely", () => {
    expect(formatAmount(null)).toBe("0.00");
    expect(formatAmount(undefined)).toBe("0.00");
    expect(formatAmount(Number.NaN)).toBe("0.00");
  });
});

describe("formatPercent", () => {
  it("formats percentages to 2 decimal places by default", () => {
    expect(formatPercent(25)).toBe("25.00%");
    expect(formatPercent(12.3456)).toBe("12.35%");
  });

  it("handles null, undefined, NaN safely", () => {
    expect(formatPercent(null)).toBe("0.00%");
    expect(formatPercent(undefined)).toBe("0.00%");
    expect(formatPercent(Number.NaN)).toBe("0.00%");
  });
});

