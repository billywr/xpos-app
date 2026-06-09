import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setOrg, setBranch, setTerminal } from "@/store/slices/orgContextSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import {
  getStoredContext,
  clearStoredContext,
  setStoredAdminContext,
  setStoredContext,
} from "@/utils/contextStorage";
import { resolveOperatorContext } from "@/utils/resolveOperatorContext";
import { useActiveOrgs } from "@/hooks/useActiveOrgs";
import { fetchBranches } from "@/api/branches";
import { filterNonDeletedBranches } from "@/types/org";

/**
 * On mount: if user is authenticated and has no org context:
 * 1) Restore from sessionStorage when persisted context exists and org is still active.
 * 2) Otherwise auto-select first active org + first branch to avoid blank pages
 *    (e.g. Analytics, Revenue).
 * 3) When org/branch/terminal are each unique, auto-resolve full operator context.
 */
export function RestoreContext() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const terminalId = useAppSelector(selectTerminalId);
  const dispatch = useAppDispatch();
  const { orgs: activeOrgs } = useActiveOrgs();
  const activeOrgIds = useMemo(
    () => new Set(activeOrgs.map((o) => o.id)),
    [activeOrgs]
  );
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

  const needsFullResolve = Boolean(token) && !terminalId;

  const { data: resolvedContext } = useQuery({
    queryKey: ["resolve-operator-context", token],
    queryFn: () => resolveOperatorContext(token),
    enabled: needsFullResolve && Boolean(token),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!token || orgId || activeOrgs.length === 0) return;
    const ctx = getStoredContext();
    if (!ctx) return;
    if (!activeOrgIds.has(ctx.orgId)) {
      clearStoredContext();
      return;
    }
    dispatch(setOrg({ orgId: ctx.orgId, orgName: ctx.orgName }));
    dispatch(setBranch({ branchId: ctx.branchId, branchName: ctx.branchName }));
    dispatch(setTerminal({ terminalId: ctx.terminalId, terminalName: ctx.terminalName }));
  }, [token, orgId, activeOrgs.length, activeOrgIds, dispatch]);

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

  useEffect(() => {
    if (!resolvedContext || terminalId) return;
    dispatch(
      setOrg({ orgId: resolvedContext.orgId, orgName: resolvedContext.orgName })
    );
    dispatch(
      setBranch({
        branchId: resolvedContext.branchId,
        branchName: resolvedContext.branchName,
      })
    );
    dispatch(
      setTerminal({
        terminalId: resolvedContext.terminalId,
        terminalName: resolvedContext.terminalName,
      })
    );
    setStoredContext(resolvedContext);
  }, [resolvedContext, terminalId, dispatch]);

  return null;
}
