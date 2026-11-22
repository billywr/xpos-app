import { describe, expect, it } from "vitest";
import {
  formatQty,
  formatQtyInput,
  formatQtyVariance,
  isValidQtyInput,
  parseQty,
  roundQty,
} from "./formatQuantity";

describe("formatQty", () => {
  it("formats whole numbers without decimals", () => {
    expect(formatQty(9)).toBe("9");
    expect(formatQty(0)).toBe("0");
  });

  it("formats one decimal place", () => {
    expect(formatQty(2.5)).toBe("2.5");
  });

  it("formats two decimal places", () => {
    expect(formatQty(8.25)).toBe("8.25");
  });

  it("strips trailing zeros", () => {
    expect(formatQty(1.5)).toBe("1.5");
    expect(formatQty(2)).toBe("2");
  });

  it("handles non-finite values", () => {
    expect(formatQty(Number.NaN)).toBe("0");
  });

  it("limits floating-point noise to 2 decimal places", () => {
    expect(formatQty(8.95 - 6.95)).toBe("2");
    expect(formatQty(1.9999999999999991)).toBe("2");
  });
});

describe("parseQty", () => {
  it("parses integers and decimals up to 2 dp", () => {
    expect(parseQty("1")).toBe(1);
    expect(parseQty("1.5")).toBe(1.5);
    expect(parseQty("1.25")).toBe(1.25);
  });

  it("returns 0 for empty input", () => {
    expect(parseQty("")).toBe(0);
    expect(parseQty("   ")).toBe(0);
  });

  it("rejects more than 2 decimal places", () => {
    expect(parseQty("1.234")).toBeNull();
  });

  it("rejects negative values", () => {
    expect(parseQty("-1")).toBeNull();
  });
});

describe("formatQtyVariance", () => {
  it("prefixes sign for non-zero values", () => {
    expect(formatQtyVariance(2.5)).toBe("+2.5");
    expect(formatQtyVariance(-1.25)).toBe("-1.25");
    expect(formatQtyVariance(0)).toBe("0");
  });

  it("handles microscopic floating-point values as zero", () => {
    expect(formatQtyVariance(0.00000000001)).toBe("0");
    expect(formatQtyVariance(-0.00000000001)).toBe("0");
  });
});

describe("isValidQtyInput", () => {
  it("allows partial decimal entry", () => {
    expect(isValidQtyInput("")).toBe(true);
    expect(isValidQtyInput("1.")).toBe(true);
    expect(isValidQtyInput("1.25")).toBe(true);
    expect(isValidQtyInput("1.234")).toBe(false);
  });
});

describe("roundQty", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundQty(1.234)).toBe(1.23);
    expect(roundQty(1.235)).toBe(1.24);
  });

  it("eliminates IEEE 754 floating-point subtraction noise", () => {
    expect(roundQty(8.95 - 6.95)).toBe(2);
    expect(roundQty(1.9999999999999991)).toBe(2);
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });
});

describe("formatQtyInput", () => {
  it("formats numbers without commas and max 2 decimal places", () => {
    expect(formatQtyInput(0)).toBe("0");
    expect(formatQtyInput(2)).toBe("2");
    expect(formatQtyInput(2.5)).toBe("2.5");
    expect(formatQtyInput(8.95)).toBe("8.95");
    expect(formatQtyInput(1000)).toBe("1000");
  });

  it("strips floating-point noise from input display", () => {
    expect(formatQtyInput(8.95 - 6.95)).toBe("2");
    expect(formatQtyInput(1.9999999999999991)).toBe("2");
  });

  it("handles null, undefined, or NaN safely", () => {
    expect(formatQtyInput(null)).toBe("0");
    expect(formatQtyInput(undefined)).toBe("0");
    expect(formatQtyInput(Number.NaN)).toBe("0");
  });
});
