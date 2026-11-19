import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { StandardStockCountSheetPage } from "@/features/operator/StandardStockCountSheetPage";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import { FileSpreadsheet } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

export function StandardStockCountAdminPage() {
  const token = useAppSelector(selectToken);
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

  const selectedOrg = filteredOrgs.find((o: Org) => o.id === selectedOrgId);
  const selectedBranch = filteredBranches.find(
    (b: Branch) => b.id === selectedBranchId
  );

  useEffect(() => {
    if (!selectedOrgId && filteredOrgs.length > 0) {
      setSelectedOrgId(filteredOrgs[0].id);
    }
  }, [filteredOrgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && !selectedBranchId && filteredBranches.length > 0) {
      setSelectedBranchId(filteredBranches[0].id);
    }
  }, [selectedOrgId, filteredBranches, selectedBranchId]);

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

  if (!selectedOrgId || !selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Stock taking (admin)"
          subtitle="View the stock taking sheet for any branch. Select organization and branch."
          icon={FileSpreadsheet}
          fallbackTo="/admin"
        />
        {(filteredOrgs.length > 1 || filteredBranches.length > 1) && (
          <div className="mb-4 flex flex-wrap items-end gap-4">
            {filteredOrgs.length > 1 && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="std-org-select"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Organization
                </label>
                <SearchableSelect
                  id="std-org-select"
                  options={orgSelectOptions}
                  value={selectedOrgId}
                  onChange={(next) => {
                    setSelectedOrgId(next);
                    setSelectedBranchId("");
                  }}
                  placeholder="Search organization…"
                  className="w-56"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
            )}
            {filteredBranches.length > 1 && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="std-branch-select"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Branch
                </label>
                <SearchableSelect
                  id="std-branch-select"
                  options={branchSelectOptions}
                  value={selectedBranchId}
                  onChange={setSelectedBranchId}
                  placeholder="Search branch…"
                  className="w-56"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
            )}
          </div>
        )}
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view the stock taking sheet.
        </div>
      </div>
    );
  }

  return (
    <StandardStockCountSheetPage
      orgId={selectedOrgId}
      branchId={selectedBranchId}
      orgName={selectedOrg?.name}
      branchName={selectedBranch?.name}
    />
  );
}
