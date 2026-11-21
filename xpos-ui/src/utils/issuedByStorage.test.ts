import { describe, expect, it, beforeEach } from "vitest";
import {
  addSavedIssuedByName,
  buildIssuedBySelectOptions,
  readDeletedIssuedByNames,
  readSavedIssuedByNames,
  removeSavedIssuedByName,
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

  it("removes a saved name and adds it to deleted list", () => {
    addSavedIssuedByName(ORG, BRANCH, "billy");
    addSavedIssuedByName(ORG, BRANCH, "Faith");

    removeSavedIssuedByName(ORG, BRANCH, "billy");

    expect(readSavedIssuedByNames(ORG, BRANCH)).toEqual(["Faith"]);
    expect(readDeletedIssuedByNames(ORG, BRANCH)).toEqual(["billy"]);
  });

  it("filters out deleted names when building select options", () => {
    const options = buildIssuedBySelectOptions(
      ["billy", "Faith", "Otongolo Brian"],
      ["billy"]
    );
    expect(options).toEqual([
      { value: "Faith", label: "Faith" },
      { value: "Otongolo Brian", label: "Otongolo Brian" },
    ]);
  });

  it("un-deletes a name when explicitly re-added", () => {
    addSavedIssuedByName(ORG, BRANCH, "billy");
    removeSavedIssuedByName(ORG, BRANCH, "billy");
    expect(readDeletedIssuedByNames(ORG, BRANCH)).toEqual(["billy"]);

    addSavedIssuedByName(ORG, BRANCH, "billy");
    expect(readDeletedIssuedByNames(ORG, BRANCH)).toEqual([]);
    expect(readSavedIssuedByNames(ORG, BRANCH)).toEqual(["billy"]);
  });
});
