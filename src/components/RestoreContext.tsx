import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setOrg, setBranch, setTerminal } from "@/store/slices/orgContextSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import { getStoredContext, clearStoredContext } from "@/utils/contextStorage";
import { fetchOrgs } from "@/api/orgs";
import { filterActiveOrgs } from "@/types/org";

/**
 * On mount: if user is authenticated and has no org context but we have
 * persisted context in sessionStorage, restore it to Redux only when the
 * persisted org is still active (deactivated orgs are not restored).
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
  const activeOrgIds = useMemo(
    () =>
      new Set(
        (orgsData?.content ? filterActiveOrgs(orgsData.content) : []).map((o) => o.id)
      ),
    [orgsData?.content]
  );

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

  return null;
}
