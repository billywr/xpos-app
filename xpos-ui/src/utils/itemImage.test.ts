import { describe, it, expect } from "vitest";
import { getItemImageName, getItemImageUrl } from "./itemImage";

describe("itemImage utility", () => {
  describe("getItemImageName", () => {
    it("returns null for empty or null input", () => {
      expect(getItemImageName(null)).toBeNull();
      expect(getItemImageName(undefined)).toBeNull();
      expect(getItemImageName("")).toBeNull();
      expect(getItemImageName("   ")).toBeNull();
    });

    it("extracts the last part of a UUID filename after the last hyphen", () => {
      expect(
        getItemImageName(
          "https://example.com/uploads/items/org-1/3244d037-b0c1-42db-ac86-b7b9cc05a831.jpg"
        )
      ).toBe("b7b9cc05a831.jpg");

      expect(
        getItemImageName("/uploads/items/org/ed5fe470-2fbc-414e-9a6c-9fe4dd411432.png")
      ).toBe("9fe4dd411432.png");
    });

    it("returns the full filename if it does not contain hyphens", () => {
      expect(getItemImageName("/uploads/items/org/coke.jpg")).toBe("coke.jpg");
    });
  });

  describe("getItemImageUrl", () => {
    it("returns trimmed url as-is if absolute", () => {
      expect(getItemImageUrl("https://cdn.example.com/pic.jpg")).toBe(
        "https://cdn.example.com/pic.jpg"
      );
    });

    it("prepends base url for relative paths", () => {
      expect(getItemImageUrl("/uploads/pic.jpg")).toContain("/uploads/pic.jpg");
    });
  });
});
