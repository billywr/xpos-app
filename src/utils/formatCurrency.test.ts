import { describe, it, expect } from "vitest";
import { formatCurrency } from "./formatCurrency";

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
});
