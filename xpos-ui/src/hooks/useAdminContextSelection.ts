import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId } from "@/store/selectors/orgContextSelectors";
import { setOrg, setBranch } from "@/store/slices/orgContextSlice";
import {
  getStoredAdminContext,
  getStoredContext,
  setStoredAdminContext,
} from "@/utils/contextStorage";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { filterActiveOrgs, filterNonDeletedBranches, type Org, type Branch } from "@/types/org";

export interface UseAdminContextSelectionOptions {
  initialOrgId?: string;
  initialBranchId?: string;
}

export interface AdminContextSelection {
  selectedOrgId: string;
  setSelectedOrgId: (orgId: string) => void;
  selectedBranchId: string;
  setSelectedBranchId: (branchId: string) => void;
  orgs: Org[];
  branches: Branch[];
  orgSelectOptions: Array<{ value: string; label: string }>;
  branchSelectOptions: Array<{ value: string; label: string }>;
  isReady: boolean;
  isLoadingOrgs: boolean;
  isLoadingBranches: boolean;
}

/**
 * Returns initial org & branch synchronously on Frame 0 from:
 * 1. Options / props
 * 2. Redux orgContext
 * 3. Session storage (admin or full operator context)
 */
function resolveInitialContext(options?: UseAdminContextSelectionOptions) {
  const storedAdmin = getStoredAdminContext();
  const storedFull = getStoredContext();
  const orgId =
    options?.initialOrgId ||
    storedAdmin?.orgId ||
    storedFull?.orgId ||
    "";
  const orgName =
    storedAdmin?.orgName ||
    storedFull?.orgName ||
    "";
  const branchId =
    options?.initialBranchId ||
    storedAdmin?.branchId ||
    storedFull?.branchId ||
    "";
  const branchName =
    storedAdmin?.branchName ||
    storedFull?.branchName ||
    "";

  return { orgId, orgName, branchId, branchName };
}

/**
 * Hook to manage Organization and Branch context in Admin pages.
 * Eliminates serial cascading waterfalls on refresh by synchronously initializing
 * from local persisted context, allowing branch and data queries to run immediately.
 */
export function useAdminContextSelection(
  options?: UseAdminContextSelectionOptions
): AdminContextSelection {
  const token = useAppSelector(selectToken);
  const reduxOrgId = useAppSelector(selectOrgId);
  const reduxBranchId = useAppSelector(selectBranchId);
  const dispatch = useAppDispatch();

  const [initial] = useState(() => {
    const fromStorage = resolveInitialContext(options);
    return {
      orgId: options?.initialOrgId || reduxOrgId || fromStorage.orgId || "",
      branchId: options?.initialBranchId || reduxBranchId || fromStorage.branchId || "",
    };
  });

  const [selectedOrgId, setSelectedOrgIdState] = useState<string>(initial.orgId);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(initial.branchId);

  // Synchronize when Redux orgId changes externally (e.g. from top bar)
  useEffect(() => {
    if (reduxOrgId && reduxOrgId !== selectedOrgId) {
      setSelectedOrgIdState(reduxOrgId);
    }
  }, [reduxOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduxBranchId && reduxBranchId !== selectedBranchId) {
      setSelectedBranchIdState(reduxBranchId);
    }
  }, [reduxBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: orgsData, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData, isLoading: isLoadingBranches } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const orgs = useMemo(() => filterActiveOrgs(orgsData?.content ?? []), [orgsData?.content]);
  const branches = useMemo(
    () => filterNonDeletedBranches(branchesData?.content ?? []),
    [branchesData?.content]
  );

  // If no org selected yet, auto-select first active org when available
  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      const first = orgs[0];
      setSelectedOrgIdState(first.id);
      dispatch(setOrg({ orgId: first.id, orgName: first.name }));
    } else if (selectedOrgId && orgs.length > 0) {
      // Validate that currently selected org still exists in active orgs list
      const matched = orgs.find((o) => o.id === selectedOrgId);
      if (!matched) {
        const first = orgs[0];
        setSelectedOrgIdState(first.id);
        dispatch(setOrg({ orgId: first.id, orgName: first.name }));
      }
    }
  }, [orgs, selectedOrgId, dispatch]);

  // If org is selected but no branch selected yet, auto-select first branch
  useEffect(() => {
    if (selectedOrgId && branches.length > 0) {
      const matched = branches.find((b) => b.id === selectedBranchId);
      if (!matched) {
        const first = branches[0];
        setSelectedBranchIdState(first.id);
        dispatch(setBranch({ branchId: first.id, branchName: first.name }));
        const orgMatch = orgs.find((o) => o.id === selectedOrgId);
        setStoredAdminContext({
          orgId: selectedOrgId,
          orgName: orgMatch?.name ?? "",
          branchId: first.id,
          branchName: first.name,
        });
      }
    } else if (!selectedOrgId) {
      setSelectedBranchIdState("");
    }
  }, [selectedOrgId, selectedBranchId, branches, orgs, dispatch]);

  const setSelectedOrgId = useCallback(
    (newOrgId: string) => {
      setSelectedOrgIdState(newOrgId);
      const matched = orgs.find((o) => o.id === newOrgId);
      if (matched) {
        dispatch(setOrg({ orgId: matched.id, orgName: matched.name }));
      }
      // Reset branch selection when org changes
      setSelectedBranchIdState("");
    },
    [orgs, dispatch]
  );

  const setSelectedBranchId = useCallback(
    (newBranchId: string) => {
      setSelectedBranchIdState(newBranchId);
      const matched = branches.find((b) => b.id === newBranchId);
      const orgMatch = orgs.find((o) => o.id === selectedOrgId);
      if (matched) {
        dispatch(setBranch({ branchId: matched.id, branchName: matched.name }));
        setStoredAdminContext({
          orgId: selectedOrgId,
          orgName: orgMatch?.name ?? "",
          branchId: matched.id,
          branchName: matched.name,
        });
      }
    },
    [branches, orgs, selectedOrgId, dispatch]
  );

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization" },
      ...orgs.map((o) => ({ value: o.id, label: o.name })),
    ],
    [orgs]
  );

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: "Select branch" },
      ...branches.map((b) => ({ value: b.id, label: b.name })),
    ],
    [branches]
  );

  return {
    selectedOrgId,
    setSelectedOrgId,
    selectedBranchId,
    setSelectedBranchId,
    orgs,
    branches,
    orgSelectOptions,
    branchSelectOptions,
    isReady: Boolean(selectedOrgId),
    isLoadingOrgs,
    isLoadingBranches,
  };
}
