import type { Org, Branch, Terminal, PageResponse } from "@/types";
import { getDatabase } from "@/db/database";

export async function fetchOrgs(_token: string | null): Promise<PageResponse<Org>> {
  const db = await getDatabase();
  const setting = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM store_settings WHERE key = 'store_name'`
  );
  const storeName = setting?.value ?? "My Store";

  const org: Org = {
    id: "offline-org",
    name: storeName,
    code: "STORE",
  };

  return {
    content: [org],
    totalElements: 1,
    totalPages: 1,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: false,
  };
}

export async function fetchBranches(
  _token: string | null,
  _orgId: string
): Promise<PageResponse<Branch>> {
  const db = await getDatabase();
  const setting = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM store_settings WHERE key = 'branch_name'`
  );
  const branchName = setting?.value ?? "Main Store";

  const branch: Branch = {
    id: "offline-branch",
    orgId: "offline-org",
    name: branchName,
    code: "MAIN",
  };

  return {
    content: [branch],
    totalElements: 1,
    totalPages: 1,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: false,
  };
}

export async function fetchTerminals(
  _token: string | null,
  _orgId: string,
  _branchId: string
): Promise<PageResponse<Terminal>> {
  const terminal: Terminal = {
    id: "offline-terminal",
    branchId: "offline-branch",
    name: "POS Register",
    code: "POS-01",
  };

  return {
    content: [terminal],
    totalElements: 1,
    totalPages: 1,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: false,
  };
}
