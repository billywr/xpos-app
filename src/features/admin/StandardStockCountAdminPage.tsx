import { useState, useEffect } from "react";
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

  if (!selectedOrgId || !selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Standard Stock Count (Admin)"
          subtitle="Bar-style sheet with System and Variance columns. Select organization and branch."
          icon={FileSpreadsheet}
          fallbackTo="/admin"
        />
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <label
            htmlFor="std-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <select
            id="std-org-select"
            value={selectedOrgId}
            onChange={(e) => {
              setSelectedOrgId(e.target.value);
              setSelectedBranchId("");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Select organization…</option>
            {filteredOrgs.map((org: Org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <label
            htmlFor="std-branch-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Branch
          </label>
          <select
            id="std-branch-select"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Select branch…</option>
            {filteredBranches.map((branch: Branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view the standard stock count sheet
          with System and Variance columns.
        </div>
      </div>
    );
  }

  return (
    <StandardStockCountSheetPage
      showSystemAndVariance
      orgId={selectedOrgId}
      branchId={selectedBranchId}
      orgName={selectedOrg?.name}
      branchName={selectedBranch?.name}
    />
  );
}
