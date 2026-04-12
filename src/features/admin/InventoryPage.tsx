import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchInventoryReport, type InventoryReportLineResponse } from "@/api/inventoryReport";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import { Pagination, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage } from "@/utils/apiError";
import { Package, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 20;

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export interface InventoryPageProps {
  initialOrgId?: string;
  initialBranchId?: string;
  onOrgChange?: (orgId: string) => void;
  onBranchChange?: (branchId: string) => void;
}

export function InventoryPage({
  initialOrgId,
  initialBranchId,
  onOrgChange,
  onBranchChange,
}: InventoryPageProps = {}) {
  const token = useAppSelector(selectToken);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId ?? "");
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
  const { searchQuery, setSearchQuery, filteredRows: filteredLines } = useTableSearch(lines);

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && filteredOrgs.length > 0) {
      setSelectedOrgId(filteredOrgs[0].id);
    }
  }, [initialOrgId, filteredOrgs, selectedOrgId]);

  useEffect(() => {
    if (initialBranchId) {
      setSelectedBranchId(initialBranchId);
    } else if (selectedOrgId && !selectedBranchId && filteredBranches.length > 0) {
      setSelectedBranchId(filteredBranches[0].id);
    }
  }, [initialBranchId, selectedOrgId, filteredBranches, selectedBranchId]);
  const totalElements = reportData?.totalElements ?? 0;

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

      <div className="mb-4 flex flex-row flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="inv-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="inv-org-select"
            options={orgSelectOptions}
            value={selectedOrgId}
            onChange={(next) => {
              setSelectedOrgId(next);
              setSelectedBranchId("");
              onOrgChange?.(next);
            }}
            placeholder="Search organization…"
            className="w-56 min-w-[12rem] max-w-[min(100%,20rem)]"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="inv-branch-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Branch
          </label>
          <SearchableSelect
            id="inv-branch-select"
            options={branchSelectOptions}
            value={selectedBranchId}
            onChange={(next) => {
              setSelectedBranchId(next);
              setPage(0);
              onBranchChange?.(next);
            }}
            placeholder="Search branch…"
            className="w-56 min-w-[12rem] max-w-[min(100%,20rem)]"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
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
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search inventory…" className="mb-4" />
          {totalElements > 0 && (
            <Pagination
              position="top"
              page={page}
              size={size}
              totalElements={totalElements}
              onPageChange={setPage}
            />
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "700px" }}>
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:bg-slate-700/80 dark:text-slate-300">
                      Item
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      SKU
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Received
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      On hand
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Sold
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Reserved
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {lines.length === 0 ? (
                          <>
                            No inventory at this branch yet.{" "}
                            <Link
                              to="/admin/inventory?tab=stock"
                              className="font-medium text-primary-600 underline hover:no-underline dark:text-primary-400"
                            >
                              Receive stock
                            </Link>{" "}
                            to add stock.
                          </>
                        ) : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map((line: InventoryReportLineResponse) => (
                      <tr
                        key={line.itemId}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm dark:bg-slate-800">
                          <span className="font-medium text-slate-800 dark:text-white">
                            {line.itemName}
                          </span>
                          {!line.trackInventory && (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                              (not tracked)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                          {line.sku ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-left text-xs tabular-nums text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-400">
                          {formatQty(line.receivedQty)}
                        </td>
                        <td className="px-2 py-1.5 text-left text-xs tabular-nums sm:px-3 sm:py-2 sm:text-sm">
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <TrendingUp className="h-4 w-4" />
                            {formatQty(line.onHandQty)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-left text-xs tabular-nums sm:px-3 sm:py-2 sm:text-sm">
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <TrendingDown className="h-4 w-4" />
                            {formatQty(line.soldQty)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-left text-xs tabular-nums text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-400">
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
