import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId } from "@/store/selectors/orgContextSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { DebtsAndExpensesPage } from "@/features/operator/DebtsAndExpensesPage";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";

import { HandCoins } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

export function DebtsAndExpensesAdminPage() {
  const token = useAppSelector(selectToken);
  const contextOrgId = useAppSelector(selectOrgId);
  const contextBranchId = useAppSelector(selectBranchId);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const orgs = orgsData?.content ?? [];
  const branches = branchesData?.content ?? [];
  const filteredOrgs = filterActiveOrgs(orgs);
  const filteredBranches = filterNonDeletedBranches(branches);

  const selectedBranch = filteredBranches.find(
    (b: Branch) => b.id === selectedBranchId
  );

  useEffect(() => {
    if (!selectedOrgId && filteredOrgs.length > 0) {
      if (contextOrgId && filteredOrgs.some((o: Org) => o.id === contextOrgId)) {
        setSelectedOrgId(contextOrgId);
      } else {
        setSelectedOrgId(filteredOrgs[0].id);
      }
    }
  }, [filteredOrgs, selectedOrgId, contextOrgId]);

  useEffect(() => {
    if (selectedOrgId && !selectedBranchId && filteredBranches.length > 0) {
      if (contextBranchId && filteredBranches.some((b: Branch) => b.id === contextBranchId)) {
        setSelectedBranchId(contextBranchId);
      } else {
        setSelectedBranchId(filteredBranches[0].id);
      }
    }
  }, [selectedOrgId, filteredBranches, selectedBranchId, contextBranchId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...filteredOrgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [filteredOrgs]
  );

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: "Select branch…" },
      ...filteredBranches.map((branch: Branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ],
    [filteredBranches]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-4 xl:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
            <HandCoins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
              Debts & expenses
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {filteredOrgs.length > 1 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="debt-org-select"
                className="text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                Org:
              </label>
              <SearchableSelect
                id="debt-org-select"
                options={orgSelectOptions}
                value={selectedOrgId}
                onChange={(next) => {
                  setSelectedOrgId(next);
                  setSelectedBranchId("");
                }}
                placeholder="Select organization…"
                className="w-48"
                compact
              />
            </div>
          )}
          {filteredBranches.length > 1 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="debt-branch-select"
                className="text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                Branch:
              </label>
              <SearchableSelect
                id="debt-branch-select"
                options={branchSelectOptions}
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                placeholder="Select branch…"
                className="w-48"
                compact
              />
            </div>
          )}
        </div>
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view debts and expenses.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DebtsAndExpensesPage
            orgId={selectedOrgId}
            branchId={selectedBranchId}
            branchName={selectedBranch?.name}
            hideHeader
          />
        </div>
      )}
    </div>
  );
}
