import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setOrg, setBranch, setTerminal } from "@/store/slices/orgContextSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectOrgName,
  selectBranchId,
  selectBranchName,
  selectTerminalId,
  selectTerminalName,
} from "@/store/selectors/orgContextSelectors";
import { useActiveOrgs } from "@/hooks/useActiveOrgs";
import { fetchBranches } from "@/api/branches";
import { fetchTerminals } from "@/api/terminals";
import { filterNonDeletedBranches, filterNonDeletedTerminals } from "@/types/org";
import { setStoredAdminContext, setStoredContext } from "@/utils/contextStorage";
import { SearchableSelect } from "@/components/SearchableSelect";

/**
 * Org, branch, and terminal dropdowns for the header. Shown so users can
 * switch context or auto-resolve terminal context for POS/Sales operations.
 */
export function ContextSelectDropdowns() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const orgName = useAppSelector(selectOrgName);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const terminalId = useAppSelector(selectTerminalId);
  const terminalName = useAppSelector(selectTerminalName);
  const dispatch = useAppDispatch();

  const { orgs } = useActiveOrgs();

  const { data: branchesData } = useQuery({
    queryKey: ["branches-header", token, orgId],
    queryFn: () => fetchBranches(token, orgId!, { size: 200 }),
    enabled: Boolean(token && orgId),
  });

  const branches = filterNonDeletedBranches(branchesData?.content ?? []);

  const { data: terminalsData } = useQuery({
    queryKey: ["terminals-header", token, orgId, branchId],
    queryFn: () => fetchTerminals(token, orgId!, branchId!, { size: 100 }),
    enabled: Boolean(token && orgId && branchId),
  });

  const terminals = filterNonDeletedTerminals(terminalsData?.content ?? []);

  useEffect(() => {
    if (!orgId || orgs.length === 0) return;
    if (!orgs.some((o) => o.id === orgId)) {
      const first = orgs[0];
      if (first) {
        dispatch(setTerminal({ terminalId: "", terminalName: "" }));
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
  const showTerminalDropdown = Boolean(orgId && branchId) && terminals.length > 1;

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

  useEffect(() => {
    if (!orgId || !branchId || terminals.length === 0) return;
    if (!terminalId || !terminals.some((t) => t.id === terminalId)) {
      const first = terminals[0];
      if (first) {
        dispatch(setTerminal({ terminalId: first.id, terminalName: first.terminalCode }));
        setStoredContext({
          orgId,
          orgName: orgName ?? "",
          branchId,
          branchName: branchName ?? "",
          terminalId: first.id,
          terminalName: first.terminalCode,
        });
      }
    }
  }, [orgId, orgName, branchId, branchName, terminalId, terminals, dispatch]);

  if (!token || !orgId) return null;

  const handleOrgChange = (id: string) => {
    const org = orgs.find((o) => o.id === id);
    if (org) {
      dispatch(setTerminal({ terminalId: "", terminalName: "" }));
      dispatch(setBranch({ branchId: "", branchName: "" }));
      dispatch(setOrg({ orgId: org.id, orgName: org.name }));
    }
  };

  const handleBranchChange = (id: string) => {
    const branch = branches.find((b) => b.id === id);
    if (branch) {
      dispatch(setTerminal({ terminalId: "", terminalName: "" }));
      dispatch(setBranch({ branchId: branch.id, branchName: branch.name }));
      setStoredAdminContext({
        orgId: orgId!,
        orgName: orgName ?? "",
        branchId: branch.id,
        branchName: branch.name,
      });
    }
  };

  const handleTerminalChange = (id: string) => {
    const term = terminals.find((t) => t.id === id);
    if (term) {
      dispatch(setTerminal({ terminalId: term.id, terminalName: term.terminalCode }));
      setStoredContext({
        orgId: orgId!,
        orgName: orgName ?? "",
        branchId: branchId!,
        branchName: branchName ?? "",
        terminalId: term.id,
        terminalName: term.terminalCode,
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

      {(showBranchDropdown || branchName) && (showTerminalDropdown || terminalName) && (
        <span className="text-slate-400 dark:text-slate-500">·</span>
      )}

      {showTerminalDropdown ? (
        <SearchableSelect
          aria-label="Select terminal"
          options={terminals.map((t) => ({ value: t.id, label: t.terminalCode }))}
          value={terminalId ?? ""}
          onChange={handleTerminalChange}
          compact
          className="min-w-[110px] max-w-[160px] sm:min-w-[130px] sm:max-w-[200px]"
          controlClassName="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
        />
      ) : terminalName && branchId ? (
        <span className="max-w-[110px] truncate text-xs text-slate-500 sm:max-w-none dark:text-slate-400">
          {terminalName}
        </span>
      ) : null}
    </div>
  );
}
