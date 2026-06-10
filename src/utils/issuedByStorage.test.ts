import { describe, expect, it, beforeEach } from "vitest";
import {
  addSavedIssuedByName,
  buildIssuedBySelectOptions,
  readSavedIssuedByNames,
} from "@/utils/issuedByStorage";

const ORG = "org-1";
const BRANCH = "branch-1";

describe("issuedByStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds and reads saved names per org and branch", () => {
    addSavedIssuedByName(ORG, BRANCH, "Jane Doe");
    addSavedIssuedByName(ORG, BRANCH, "John Kamau");

    expect(readSavedIssuedByNames(ORG, BRANCH)).toEqual(["John Kamau", "Jane Doe"]);
  });

  it("dedupes case-insensitively and moves latest to front", () => {
    addSavedIssuedByName(ORG, BRANCH, "Brian");
    addSavedIssuedByName(ORG, BRANCH, "brian");

    expect(readSavedIssuedByNames(ORG, BRANCH)).toEqual(["brian"]);
  });

  it("builds sorted select options from mixed sources", () => {
    const options = buildIssuedBySelectOptions(["Zed", "Amy", "Amy", "  "]);
    expect(options).toEqual([
      { value: "Amy", label: "Amy" },
      { value: "Zed", label: "Zed" },
    ]);
  });
});
