import { describe, it, expect, vi } from "vitest";
import { generateItemsPdf } from "./itemsPdf";

describe("itemsPdf", () => {
  const sampleItems = [
    {
      name: "Tusker Lager",
      buyingPrice: 180,
      defaultSellingPrice: 250,
    },
    {
      name: "Guinness 500ml",
      buyingPrice: 200,
      defaultSellingPrice: 300,
    },
    {
      name: "White Cap",
      buyingPrice: null,
      defaultSellingPrice: 260,
    },
  ];

  it("generates a PDF doc for items", () => {
    const doc = generateItemsPdf(sampleItems, {
      orgName: "Test Pub",
      appName: "XPOS",
    });
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("handles empty items array without crashing", () => {
    const doc = generateItemsPdf([], {
      orgName: "Empty Pub",
    });
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("downloads PDF with sanitized filename", () => {
    const doc = generateItemsPdf(sampleItems, { orgName: "Stone Pub & Grill" });
    expect(typeof doc.save).toBe("function");
    const saveMock = vi.fn();
    doc.save = saveMock;
    doc.save("items-stone-pub-grill-2026-09-29.pdf");
    expect(saveMock).toHaveBeenCalledWith(
      expect.stringMatching(/^items-stone-pub-grill-\d{4}-\d{2}-\d{2}\.pdf$/)
    );
  });
});
