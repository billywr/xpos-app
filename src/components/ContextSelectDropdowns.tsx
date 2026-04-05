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
  selectBranchName,
} from "@/store/selectors/orgContextSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  filterActiveOrgs,
  filterNonDeletedBranches,
} from "@/types/org";
import { setStoredAdminContext } from "@/utils/contextStorage";
import { SearchableSelect } from "@/components/SearchableSelect";

/**
 * Org and branch dropdowns for the header. Shown only when there is more
 * than one org or more than one branch, so users can switch context.
 */
export function ContextSelectDropdowns() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const orgName = useAppSelector(selectOrgName);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const dispatch = useAppDispatch();

  const { data: orgsData } = useQuery({
    queryKey: ["orgs-header", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches-header", token, orgId],
    queryFn: () => fetchBranches(token, orgId!, { size: 200 }),
    enabled: Boolean(token && orgId),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);

  useEffect(() => {
    if (!orgId || orgs.length === 0) return;
    if (!orgs.some((o) => o.id === orgId)) {
      const first = orgs[0];
      if (first) {
        dispatch(setBranch({ branchId: "", branchName: "" }));
        dispatch(setOrg({ orgId: first.id, orgName: first.name }));
        setStoredAdminContext({
          orgId: first.id,
          orgName: first.name,
          branchId: "",
          branchName: "",
        });
      }
    }
  }, [orgId, orgs, dispatch]);

  const showOrgDropdown = orgs.length > 1;
  const showBranchDropdown = Boolean(orgId) && branches.length > 1;

  useEffect(() => {
    if (!orgId || branchId || branches.length === 0) return;
    const first = branches[0];
    if (first) {
      dispatch(setBranch({ branchId: first.id, branchName: first.name }));
      setStoredAdminContext({
        orgId,
        orgName: orgName ?? "",
        branchId: first.id,
        branchName: first.name,
      });
    }
  }, [orgId, orgName, branchId, branches, dispatch]);

  if (!token || !orgId) return null;

  const handleOrgChange = (id: string) => {
    const org = orgs.find((o) => o.id === id);
    if (org) {
      dispatch(setOrg({ orgId: org.id, orgName: org.name }));
    }
  };

  const handleBranchChange = (id: string) => {
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showOrgDropdown ? (
        <SearchableSelect
          aria-label="Select organization"
          options={orgs.map((o) => ({ value: o.id, label: o.name }))}
          value={orgId ?? ""}
          onChange={handleOrgChange}
          compact
          className="min-w-[120px] max-w-[180px] sm:min-w-[140px] sm:max-w-[220px]"
          controlClassName="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
        />
      ) : orgName ? (
        <span className="max-w-[120px] truncate text-sm text-slate-600 sm:max-w-none dark:text-slate-400">
          {orgName}
        </span>
      ) : null}

      {(showOrgDropdown || orgName) && (showBranchDropdown || branchName) && (
        <span className="text-slate-400 dark:text-slate-500">/</span>
      )}

      {showBranchDropdown ? (
        <SearchableSelect
          aria-label="Select branch"
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
          value={branchId ?? ""}
          onChange={handleBranchChange}
          compact
          className="min-w-[120px] max-w-[180px] sm:min-w-[140px] sm:max-w-[220px]"
          controlClassName="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
        />
      ) : branchName && orgId ? (
        <span className="max-w-[120px] truncate text-sm text-slate-600 sm:max-w-none dark:text-slate-400">
          {branchName}
        </span>
      ) : null}
    </div>
  );
}
