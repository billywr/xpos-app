import { beforeEach, describe, expect, it } from "vitest";
import {
  getLastMpesaStkPhone,
  getMpesaStkPhoneSuggestions,
  rememberMpesaStkPhone,
} from "@/utils/mpesaPhoneHistory";

const ORG = "org-1";
const BRANCH = "branch-1";

describe("mpesaPhoneHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remembers phones newest first", () => {
    rememberMpesaStkPhone(ORG, BRANCH, "254712345678");
    rememberMpesaStkPhone(ORG, BRANCH, "254700000000");
    expect(getLastMpesaStkPhone(ORG, BRANCH)).toBe("254700000000");
    expect(getMpesaStkPhoneSuggestions(ORG, BRANCH)).toEqual([
      "254700000000",
      "254712345678",
    ]);
  });

  it("dedupes and moves existing phone to front", () => {
    rememberMpesaStkPhone(ORG, BRANCH, "254712345678");
    rememberMpesaStkPhone(ORG, BRANCH, "254700000000");
    rememberMpesaStkPhone(ORG, BRANCH, "254712345678");
    expect(getMpesaStkPhoneSuggestions(ORG, BRANCH)).toEqual([
      "254712345678",
      "254700000000",
    ]);
  });

  it("filters suggestions by partial query", () => {
    rememberMpesaStkPhone(ORG, BRANCH, "254712345678");
    rememberMpesaStkPhone(ORG, BRANCH, "254798765432");
    expect(getMpesaStkPhoneSuggestions(ORG, BRANCH, "7123")).toEqual([
      "254712345678",
    ]);
  });
});
