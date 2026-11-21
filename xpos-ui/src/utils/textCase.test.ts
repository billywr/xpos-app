import { describe, it, expect } from "vitest";
import { toSentenceCase } from "./textCase";

describe("toSentenceCase", () => {
  it("handles empty or falsy inputs", () => {
    expect(toSentenceCase("")).toBe("");
    expect(toSentenceCase(null)).toBe("");
    expect(toSentenceCase(undefined)).toBe("");
  });

  it("converts ALL CAPS strings to Sentence case", () => {
    expect(toSentenceCase("CUSTOMER NAME")).toBe("Customer name");
    expect(toSentenceCase("ITEM NAME")).toBe("Item name");
    expect(toSentenceCase("ACTIONS")).toBe("Actions");
    expect(toSentenceCase("CREATED AT")).toBe("Created at");
  });

  it("converts Title Case strings to Sentence case", () => {
    expect(toSentenceCase("Buying Price")).toBe("Buying price");
    expect(toSentenceCase("Selling Price")).toBe("Selling price");
    expect(toSentenceCase("Due Date")).toBe("Due date");
    expect(toSentenceCase("Phone Number")).toBe("Phone number");
  });

  it("preserves proper nouns and system brand names", () => {
    expect(toSentenceCase("M-PESA")).toBe("M-Pesa");
    expect(toSentenceCase("m-pesa reference")).toBe("M-Pesa reference");
    expect(toSentenceCase("XPOS POS SYSTEM")).toBe("XPOS POS system");
  });

  it("preserves currencies and parenthesized units", () => {
    expect(toSentenceCase("TOTAL AMOUNT (KSH)")).toBe("Total amount (KSh)");
    expect(toSentenceCase("Buying price (ksh)")).toBe("Buying price (KSh)");
    expect(toSentenceCase("Amount (KES)")).toBe("Amount (KES)");
    expect(toSentenceCase("Weight (kg)")).toBe("Weight (kg)");
  });

  it("preserves technical acronyms", () => {
    expect(toSentenceCase("SKU NUMBER")).toBe("SKU number");
    expect(toSentenceCase("ENTER PIN")).toBe("Enter PIN");
    expect(toSentenceCase("VAT AMOUNT")).toBe("VAT amount");
    expect(toSentenceCase("EXPORT CSV")).toBe("Export CSV");
    expect(toSentenceCase("DOWNLOAD PDF")).toBe("Download PDF");
    expect(toSentenceCase("Z-REPORT")).toBe("Z-Report");
    expect(toSentenceCase("REVENUE & P&L")).toBe("Revenue & P&L");
    expect(toSentenceCase("NO.")).toBe("No.");
  });

  it("converts SCREAMING_SNAKE_CASE enums to Sentence case", () => {
    expect(toSentenceCase("IN_PROGRESS")).toBe("In progress");
    expect(toSentenceCase("STOCK_TAKING")).toBe("Stock taking");
    expect(toSentenceCase("ACTIVE")).toBe("Active");
    expect(toSentenceCase("SETTLED")).toBe("Settled");
  });

  it("capitalizes after sentence-ending punctuation", () => {
    expect(
      toSentenceCase("No items yet. Add one to get started.")
    ).toBe("No items yet. Add one to get started.");
  });

  it("handles slashes and compound labels", () => {
    expect(toSentenceCase("Add / Edit Item")).toBe("Add / edit item");
    expect(toSentenceCase("Stock receiving / add stock")).toBe("Stock receiving / add stock");
    expect(toSentenceCase("Receipt / Voucher Ref")).toBe("Receipt / voucher ref");
    expect(toSentenceCase("Notes / Description")).toBe("Notes / description");
  });
});
