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
import { ChevronDown, Building2, MapPin } from "lucide-react";

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

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const org = orgs.find((o) => o.id === id);
    if (org) {
      dispatch(setOrg({ orgId: org.id, orgName: org.name }));
    }
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
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

  const selectClass =
    "appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-primary-400 dark:focus:ring-primary-400";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <div className="relative">
          <select
            value={orgId ?? ""}
            onChange={handleOrgChange}
            aria-label="Filter by organization"
            className={selectClass}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <div className="relative">
          <select
            value={branchId ?? ""}
            onChange={handleBranchChange}
            aria-label="Filter by branch"
            className={selectClass}
          >
            <option value="">
              {!branchesLoaded
                ? "Loading…"
                : branches.length === 0
                  ? "No branches"
                  : "Select branch"}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
