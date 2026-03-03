import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setOrg, setBranch, setTerminal } from "@/store/slices/orgContextSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import {
  getStoredContext,
  clearStoredContext,
  setStoredAdminContext,
} from "@/utils/contextStorage";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  filterActiveOrgs,
  filterNonDeletedBranches,
} from "@/types/org";

/**
 * On mount: if user is authenticated and has no org context:
 * 1) Restore from sessionStorage when persisted context exists and org is still active.
 * 2) Otherwise auto-select first active org + first branch to avoid blank pages
 *    (e.g. Analytics, Revenue).
 */
export function RestoreContext() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const dispatch = useAppDispatch();
  const { data: orgsData } = useQuery({
    queryKey: ["orgs", token],
    queryFn: () => fetchOrgs(token, { size: 100 }),
    enabled: Boolean(token) && !orgId,
  });
  const activeOrgs = useMemo(
    () => filterActiveOrgs(orgsData?.content ?? []),
    [orgsData?.content]
  );
  const activeOrgIds = useMemo(() => new Set(activeOrgs.map((o) => o.id)), [activeOrgs]);
  const firstOrg = activeOrgs[0] ?? null;

  const { data: branchesData } = useQuery({
    queryKey: ["branches-auto", token, firstOrg?.id],
    queryFn: () => fetchBranches(token, firstOrg!.id, { size: 100 }),
    enabled:
      Boolean(token) &&
      !orgId &&
      Boolean(firstOrg) &&
      !getStoredContext(),
  });
  const branches = useMemo(
    () => filterNonDeletedBranches(branchesData?.content ?? []),
    [branchesData?.content]
  );
  const firstBranch = branches[0] ?? null;

  useEffect(() => {
    if (!token || orgId || activeOrgIds.size === 0) return;
    const ctx = getStoredContext();
    if (!ctx) return;
    if (!activeOrgIds.has(ctx.orgId)) {
      clearStoredContext();
      return;
    }
    dispatch(setOrg({ orgId: ctx.orgId, orgName: ctx.orgName }));
    dispatch(setBranch({ branchId: ctx.branchId, branchName: ctx.branchName }));
    dispatch(setTerminal({ terminalId: ctx.terminalId, terminalName: ctx.terminalName }));
  }, [token, orgId, activeOrgIds, dispatch]);

  useEffect(() => {
    if (!token || orgId || !firstOrg || getStoredContext()) return;
    dispatch(setOrg({ orgId: firstOrg.id, orgName: firstOrg.name }));
    if (firstBranch) {
      dispatch(setBranch({ branchId: firstBranch.id, branchName: firstBranch.name }));
      setStoredAdminContext({
        orgId: firstOrg.id,
        orgName: firstOrg.name,
        branchId: firstBranch.id,
        branchName: firstBranch.name,
      });
    }
  }, [token, orgId, firstOrg, firstBranch, dispatch]);

  return null;
}
