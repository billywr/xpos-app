import { fetchBranches } from "@/api/branches";
import { fetchOrgs } from "@/api/orgs";
import { fetchTerminals } from "@/api/terminals";
import {
  filterActiveOrgs,
  filterNonDeletedBranches,
  filterNonDeletedTerminals,
} from "@/types/org";
import type { StoredContext } from "@/utils/contextStorage";

const RESOLVE_FETCH_SIZE = 100;

/**
 * When the user has exactly one active org, one branch, and one terminal,
 * returns full operator context. Otherwise returns null (user must pick).
 */
export async function resolveOperatorContext(
  token: string | null
): Promise<StoredContext | null> {
  if (!token) {
    return null;
  }

  const orgsData = await fetchOrgs(token, { page: 0, size: RESOLVE_FETCH_SIZE });
  const orgs = filterActiveOrgs(orgsData.content ?? []);
  if (orgs.length !== 1) {
    return null;
  }

  const org = orgs[0];
  const branchesData = await fetchBranches(token, org.id, {
    page: 0,
    size: RESOLVE_FETCH_SIZE,
  });
  const branches = filterNonDeletedBranches(branchesData.content ?? []);
  if (branches.length !== 1) {
    return null;
  }

  const branch = branches[0];
  const terminalsData = await fetchTerminals(token, org.id, branch.id, {
    page: 0,
    size: RESOLVE_FETCH_SIZE,
  });
  const terminals = filterNonDeletedTerminals(terminalsData.content ?? []);
  if (terminals.length !== 1) {
    return null;
  }

  const terminal = terminals[0];
  return {
    orgId: org.id,
    orgName: org.name,
    branchId: branch.id,
    branchName: branch.name,
    terminalId: terminal.id,
    terminalName: terminal.terminalCode,
  };
}
