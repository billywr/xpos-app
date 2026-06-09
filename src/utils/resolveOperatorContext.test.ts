import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveOperatorContext } from "./resolveOperatorContext";

vi.mock("@/api/orgs", () => ({
  fetchOrgs: vi.fn(),
}));

vi.mock("@/api/branches", () => ({
  fetchBranches: vi.fn(),
}));

vi.mock("@/api/terminals", () => ({
  fetchTerminals: vi.fn(),
}));

import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchTerminals } from "@/api/terminals";
import type { Branch, Org, Terminal } from "@/types/org";

function mockPage<T>(content: T[]): {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
} {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 100,
    number: 0,
    first: true,
    last: true,
  };
}
const ts = "2026-01-01T00:00:00Z";

function mockOrg(overrides: Partial<Org> & Pick<Org, "id" | "name">): Org {
  return {
    status: "ACTIVE",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function mockBranch(
  overrides: Partial<Branch> & Pick<Branch, "id" | "name" | "orgId">
): Branch {
  return {
    businessId: "biz-1",
    timezone: "Africa/Nairobi",
    currency: "KES",
    status: "ACTIVE",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function mockTerminal(
  overrides: Partial<Terminal> & Pick<Terminal, "id" | "terminalCode" | "orgId" | "branchId">
): Terminal {
  return {
    status: "ACTIVE",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

const token = "test-token";

describe("resolveOperatorContext", () => {
  beforeEach(() => {
    vi.mocked(fetchOrgs).mockReset();
    vi.mocked(fetchBranches).mockReset();
    vi.mocked(fetchTerminals).mockReset();
  });

  it("returns null when token is missing", async () => {
    expect(await resolveOperatorContext(null)).toBeNull();
  });

  it("returns full context when org, branch, and terminal are each unique", async () => {
    vi.mocked(fetchOrgs).mockResolvedValue(
      mockPage([mockOrg({ id: "org-1", name: "Stone Pub" })])
    );
    vi.mocked(fetchBranches).mockResolvedValue(
      mockPage([mockBranch({ id: "branch-1", name: "Main", orgId: "org-1" })])
    );
    vi.mocked(fetchTerminals).mockResolvedValue(
      mockPage([
        mockTerminal({
          id: "term-1",
          terminalCode: "T1",
          orgId: "org-1",
          branchId: "branch-1",
        }),
      ])
    );

    expect(await resolveOperatorContext(token)).toEqual({
      orgId: "org-1",
      orgName: "Stone Pub",
      branchId: "branch-1",
      branchName: "Main",
      terminalId: "term-1",
      terminalName: "T1",
    });
  });

  it("returns null when multiple active orgs exist", async () => {
    vi.mocked(fetchOrgs).mockResolvedValue(
      mockPage([
        mockOrg({ id: "org-1", name: "A" }),
        mockOrg({ id: "org-2", name: "B" }),
      ])
    );

    expect(await resolveOperatorContext(token)).toBeNull();
    expect(fetchBranches).not.toHaveBeenCalled();
  });

  it("returns null when multiple branches exist", async () => {
    vi.mocked(fetchOrgs).mockResolvedValue(
      mockPage([mockOrg({ id: "org-1", name: "Stone Pub" })])
    );
    vi.mocked(fetchBranches).mockResolvedValue(
      mockPage([
        mockBranch({ id: "branch-1", name: "Main", orgId: "org-1" }),
        mockBranch({ id: "branch-2", name: "Second", orgId: "org-1" }),
      ])
    );

    expect(await resolveOperatorContext(token)).toBeNull();
    expect(fetchTerminals).not.toHaveBeenCalled();
  });

  it("returns null when multiple terminals exist", async () => {
    vi.mocked(fetchOrgs).mockResolvedValue(
      mockPage([mockOrg({ id: "org-1", name: "Stone Pub" })])
    );
    vi.mocked(fetchBranches).mockResolvedValue(
      mockPage([mockBranch({ id: "branch-1", name: "Main", orgId: "org-1" })])
    );
    vi.mocked(fetchTerminals).mockResolvedValue(
      mockPage([
        mockTerminal({
          id: "term-1",
          terminalCode: "T1",
          orgId: "org-1",
          branchId: "branch-1",
        }),
        mockTerminal({
          id: "term-2",
          terminalCode: "T2",
          orgId: "org-1",
          branchId: "branch-1",
        }),
      ])
    );

    expect(await resolveOperatorContext(token)).toBeNull();
  });
});
