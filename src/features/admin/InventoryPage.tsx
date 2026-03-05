import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchInventoryReport, type InventoryReportLineResponse } from "@/api/inventoryReport";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/ui";
import { getApiErrorMessage } from "@/utils/apiError";
import { Package, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const DEFAULT_PAGE_SIZE = 20;

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function InventoryPage() {
  const token = useAppSelector(selectToken);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);

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

  const {
    data: reportData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-inventory-report", token, selectedOrgId, selectedBranchId, page, size],
    queryFn: () =>
      fetchInventoryReport(token, selectedOrgId, selectedBranchId, { page, size }),
    enabled:
      Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const orgs = orgsData?.content ?? [];
  const branches = branchesData?.content ?? [];
  const filteredOrgs = filterActiveOrgs(orgs);
  const filteredBranches = filterNonDeletedBranches(branches);
  const lines = reportData?.content ?? [];

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
  const totalElements = reportData?.totalElements ?? 0;

  if (isLoading && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Inventory"
          subtitle="Loading…"
          icon={Package}
          fallbackTo="/admin"
        />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Inventory"
          icon={Package}
          fallbackTo="/admin"
        />
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Inventory"
        subtitle="Track sold items versus remaining stock by branch. Select organization and branch to view inventory."
        icon={Package}
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="inv-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="inv-org-select"
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
          htmlFor="inv-branch-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Branch
        </label>
        <select
          id="inv-branch-select"
          value={selectedBranchId}
          onChange={(e) => {
            setSelectedBranchId(e.target.value);
            setPage(0);
          }}
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

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view inventory (sold vs remaining).
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Sold vs remaining
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Received
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Remaining (on hand)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Sold
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Reserved
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No inventory at this branch yet.{" "}
                        <Link
                          to="/admin/goods-receipt"
                          className="font-medium text-primary-600 underline hover:no-underline dark:text-primary-400"
                        >
                          Receive goods
                        </Link>{" "}
                        to add stock.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line: InventoryReportLineResponse) => (
                      <tr
                        key={line.itemId}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800 dark:text-white">
                            {line.itemName}
                          </span>
                          {!line.trackInventory && (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                              (not tracked)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {line.sku ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-slate-600 dark:text-slate-400">
                          {formatQty(line.receivedQty)}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums">
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <TrendingUp className="h-4 w-4" />
                            {formatQty(line.onHandQty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums">
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <TrendingDown className="h-4 w-4" />
                            {formatQty(line.soldQty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-slate-600 dark:text-slate-400">
                          {formatQty(line.reservedQty)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalElements > 0 && (
              <Pagination
                page={page}
                size={size}
                totalElements={totalElements}
                onPageChange={setPage}
                onSizeChange={(s) => {
                  setSize(s);
                  setPage(0);
                }}
                sizeOptions={[10, 20, 50]}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
