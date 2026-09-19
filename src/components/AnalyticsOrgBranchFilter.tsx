import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setOrg, setBranch } from "@/store/slices/orgContextSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectOrgName,
  selectBranchId,
} from "@/store/selectors/orgContextSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  filterActiveOrgs,
  filterNonDeletedBranches,
} from "@/types/org";
import { setStoredAdminContext } from "@/utils/contextStorage";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Building2, MapPin } from "lucide-react";

/**
 * Org and branch dropdowns for filtering analytics. Always visible when context
 * is set, so users can switch org/branch directly on the Analytics page.
 */
export function AnalyticsOrgBranchFilter() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const orgName = useAppSelector(selectOrgName);
  const branchId = useAppSelector(selectBranchId);
  const dispatch = useAppDispatch();

  const { data: orgsData } = useQuery({
    queryKey: ["orgs-analytics-filter", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches-analytics-filter", token, orgId],
    queryFn: () => fetchBranches(token, orgId!, { size: 200 }),
    enabled: Boolean(token && orgId),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);

  useEffect(() => {
    if (!orgId || !branchesData) return;
    if (branches.length === 0) {
      if (branchId) {
        dispatch(setBranch({ branchId: "", branchName: "" }));
        setStoredAdminContext({
          orgId,
          orgName: orgName ?? "",
          branchId: "",
          branchName: "",
        });
      }
      return;
    }
    const first = branches[0];
    if (!branchId) {
      dispatch(setBranch({ branchId: first.id, branchName: first.name }));
      setStoredAdminContext({
        orgId,
        orgName: orgName ?? "",
        branchId: first.id,
        branchName: first.name,
      });
    }
  }, [orgId, orgName, branchId, branches, branchesData, dispatch]);

  const branchesLoaded = branchesData !== undefined;

  if (!token || !orgId) return null;

  const handleOrgChange = (id: string) => {
    const org = orgs.find((o) => o.id === id);
    if (org) {
      dispatch(setOrg({ orgId: org.id, orgName: org.name }));
    }
  };

  const handleBranchChange = (id: string) => {
    if (!id) {
      return;
    }
    const branch = branches.find((b) => b.id === id);
    if (branch) {
      dispatch(setBranch({ branchId: branch.id, branchName: branch.name }));
      setStoredAdminContext({
        orgId: orgId!,
        orgName: orgName ?? "",
        branchId: branch.id,
        branchName: branch.name,
      });
    }
  };

  const branchPlaceholderLabel = !branchesLoaded
    ? "Loading…"
    : branches.length === 0
      ? "No branches"
      : "Select branch";

  const branchOptions = [
    { value: "", label: branchPlaceholderLabel },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  if (orgs.length <= 1 && branches.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {orgs.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <SearchableSelect
            aria-label="Filter by organization"
            options={orgs.map((o) => ({ value: o.id, label: o.name }))}
            value={orgId ?? ""}
            onChange={handleOrgChange}
            className="min-w-[160px] max-w-[240px]"
            controlClassName="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      )}
      {branches.length > 1 && (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <SearchableSelect
            aria-label="Filter by branch"
            options={branchOptions}
            value={branchId ?? ""}
            onChange={handleBranchChange}
            placeholder={branchPlaceholderLabel}
            className="min-w-[160px] max-w-[240px]"
            controlClassName="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      )}
    </div>
  );
}
