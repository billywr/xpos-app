import { Fragment, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchAdminSales,
  type SaleSummary,
  type FetchAdminSalesParams,
} from "@/api/adminSales";
import { fetchReceiptDetails } from "@/api/sales";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import {
  Pagination,
  SortableTableHead,
  TableSearchInput,
  TableSkeleton,
} from "@/components/ui";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatCurrency, formatAmount } from "@/utils/formatCurrency";
import { Receipt, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
/** Admin API clamps page size; use for summing all sales in range. */
const ADMIN_SUM_PAGE_SIZE = 200;
const SALES_SORT = {
  receiptNumber: (row: SaleSummary) => row.receiptNumber ?? "",
  completedAt: (row: SaleSummary) => row.completedAt ?? "",
  cashier: (row: SaleSummary) => row.createdByUsername ?? "",
  total: (row: SaleSummary) => row.total,
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SalesListPage() {
  const token = useAppSelector(selectToken);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const [fromDate, setFromDate] = useState<string>(toDateStr(defaultFrom));
  const [toDate, setToDate] = useState<string>(toDateStr(today));
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

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

  const params: FetchAdminSalesParams = {
    page,
    size,
    status: "COMPLETED",
    fromDate,
    toDate,
  };

  const { data: salesData, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-sales", token, selectedOrgId, selectedBranchId, params],
    queryFn: () =>
      fetchAdminSales(token, selectedOrgId, selectedBranchId, params),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const sales = salesData?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredSales,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: sales,
    serverTotalElements: salesData?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: [
      "admin-sales",
      token,
      selectedOrgId,
      selectedBranchId,
      fromDate,
      toDate,
    ],
    searchAllQueryFn: (fetchSize) =>
      fetchAdminSales(token, selectedOrgId, selectedBranchId, {
        page: 0,
        size: fetchSize,
        status: "COMPLETED",
        fromDate,
        toDate,
      }),
    searchAllEnabled:
      Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
    sortAccessors: SALES_SORT,
  });

  const showReceiptCol = useMemo(
    () =>
      filteredSales.some((s: SaleSummary) => s.receiptNumber != null),
    [filteredSales]
  );
  const showCompletedCol = useMemo(
    () => filteredSales.some((s: SaleSummary) => !!s.completedAt),
    [filteredSales]
  );
  const showCashierCol = useMemo(
    () =>
      filteredSales.some(
        (s: SaleSummary) =>
          !!s.createdByUsername &&
          s.createdByUsername.trim() !== "" &&
          s.createdByUsername !== "—"
      ),
    [filteredSales]
  );
  const visibleSalesColCount =
    2 +
    (showReceiptCol ? 1 : 0) +
    (showCompletedCol ? 1 : 0) +
    (showCashierCol ? 1 : 0);

  const { data: totalSalesSum = 0 } = useQuery({
    queryKey: [
      "admin-sales-sum",
      token,
      selectedOrgId,
      selectedBranchId,
      fromDate,
      toDate,
      totalElements,
    ],
    queryFn: async () => {
      if (!token || !selectedOrgId || !selectedBranchId || totalElements === 0) {
        return 0;
      }
      const pages = Math.ceil(totalElements / ADMIN_SUM_PAGE_SIZE);
      let sum = 0;
      for (let p = 0; p < pages; p++) {
        const res = await fetchAdminSales(token, selectedOrgId, selectedBranchId, {
          page: p,
          size: ADMIN_SUM_PAGE_SIZE,
          status: "COMPLETED",
          fromDate,
          toDate,
        });
        for (const row of res.content) {
          sum += row.total;
        }
      }
      return sum;
    },
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId) &&
      totalElements > 0,
  });

  const expandedSale = sales.find((s: SaleSummary) => s.id === expandedSaleId);
  const { data: receiptDetails, isLoading: receiptLoading } = useQuery({
    queryKey: [
      "receipt-details",
      token,
      selectedOrgId,
      selectedBranchId,
      expandedSale?.terminalId,
      expandedSaleId,
    ],
    queryFn: () =>
      fetchReceiptDetails(
        token,
        selectedOrgId!,
        selectedBranchId!,
        expandedSale!.terminalId,
        expandedSaleId!
      ),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId) &&
      Boolean(expandedSaleId) &&
      Boolean(expandedSale?.terminalId),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  const selectedBranch = branches.find((b: Branch) => b.id === selectedBranchId);

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedOrgId, branches, selectedBranchId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: "Select branch…" },
      ...branches.map((branch: Branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ],
    [branches]
  );

  if (isError && selectedOrgId && selectedBranchId) {
    const message = getApiErrorMessage(error);
    const requestId = getApiErrorRequestId(error);
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Sales
        </h1>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{message}</p>
          {requestId && (
            <p className="mt-2 text-sm opacity-90">
              Reference:{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                {requestId}
              </code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <Receipt className="h-7 w-7" />
            Sales
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            View completed sales by branch. Select org, branch, and date range.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-row flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="sales-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="sales-org-select"
            options={orgSelectOptions}
            value={selectedOrgId}
            onChange={(next) => {
              setSelectedOrgId(next);
              setSelectedBranchId("");
              setPage(0);
            }}
            placeholder="Search organization…"
            className="w-full sm:w-56 min-w-[12rem] max-w-[min(100%,20rem)]"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="sales-branch-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Branch
          </label>
          <SearchableSelect
            id="sales-branch-select"
            options={branchSelectOptions}
            value={selectedBranchId}
            onChange={(next) => {
              setSelectedBranchId(next);
              setPage(0);
            }}
            placeholder="Search branch…"
            className="w-full sm:w-56 min-w-[12rem] max-w-[min(100%,20rem)]"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sales-from-date"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              From
            </label>
            <input
              id="sales-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sales-to-date"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              To
            </label>
            <input
              id="sales-to-date"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization and branch to view sales.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search sales…" className="mb-4" />
          {totalElements > 0 && (
            <Pagination
              position="top"
              page={page}
              size={size}
              totalElements={totalElements}
              onPageChange={setPage}
              onSizeChange={handleSizeChange}
              sizeOptions={[10, 25, 50, 100]}
              onRefresh={() => void refetch()}
              isRefreshing={isFetching}
            />
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "600px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <SortableTableHead
                      columnKey="expand"
                      label=""
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      sortable={false}
                      className="sticky left-0 z-20 w-10 bg-slate-50 px-4 py-3 sm:py-3 dark:bg-slate-700"
                    />
                    {showReceiptCol && (
                      <SortableTableHead
                        columnKey="receiptNumber"
                        label="Receipt #"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className="px-4 py-3 text-left text-base font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-2xl dark:text-slate-300"
                      />
                    )}
                    {showCompletedCol && (
                      <SortableTableHead
                        columnKey="completedAt"
                        label="Completed"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className="px-4 py-3 text-left text-base font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-2xl dark:text-slate-300"
                      />
                    )}
                    {showCashierCol && (
                      <SortableTableHead
                        columnKey="cashier"
                        label="Cashier"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className="px-4 py-3 text-left text-base font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-2xl dark:text-slate-300"
                      />
                    )}
                    <SortableTableHead
                      columnKey="total"
                      label="Total (KSH)"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className="px-4 py-3 text-left text-base font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-2xl dark:text-slate-300"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {isLoading && sales.length === 0 ? (
                    <TableSkeleton rows={10} columns={visibleSalesColCount} />
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleSalesColCount}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {sales.length === 0 ? `No completed sales for ${selectedBranch?.name ?? "this branch"} in the selected date range.` : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale: SaleSummary) => (
                      <Fragment key={sale.id}>
                        <tr
                          key={sale.id}
                          className="group hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <td className="sticky left-0 z-10 w-10 bg-white group-hover:!bg-slate-100 px-4 py-2 sm:py-2.5 dark:bg-slate-800 dark:group-hover:!bg-slate-700">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSaleId(
                                  expandedSaleId === sale.id ? null : sale.id
                                )
                              }
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                              aria-label={
                                expandedSaleId === sale.id
                                  ? "Collapse items"
                                  : "Expand items"
                              }
                            >
                              {expandedSaleId === sale.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          {showReceiptCol && (
                            <td className="px-4 py-2 font-mono text-base font-semibold text-slate-700 sm:px-6 sm:py-2.5 sm:text-2xl dark:text-slate-300">
                              {sale.receiptNumber ?? "—"}
                            </td>
                          )}
                          {showCompletedCol && (
                            <td className="px-4 py-2 text-base text-slate-600 sm:px-6 sm:py-2.5 sm:text-2xl dark:text-slate-400">
                              {sale.completedAt
                                ? new Date(sale.completedAt).toLocaleString()
                                : "—"}
                            </td>
                          )}
                          {showCashierCol && (
                            <td className="px-4 py-2 text-base text-slate-600 sm:px-6 sm:py-2.5 sm:text-2xl dark:text-slate-400">
                              {sale.createdByUsername ?? "—"}
                            </td>
                          )}
                          <td className="px-4 py-2 text-left text-base tabular-nums font-semibold text-slate-700 sm:px-6 sm:py-2.5 sm:text-2xl dark:text-slate-300">
                            {formatAmount(sale.total)}
                          </td>
                        </tr>
                        {expandedSaleId === sale.id && (
                          <tr key={`${sale.id}-expanded`}>
                            <td
                              colSpan={visibleSalesColCount}
                              className="bg-slate-50 px-4 py-3 dark:bg-slate-800/50"
                            >
                              {receiptLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading items…
                                </div>
                              ) : receiptDetails?.lines && receiptDetails.lines.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-[200px] text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700">
                                      <tr className="border-b border-slate-200 dark:border-slate-600">
                                        <th className="pb-2 pr-4 text-left font-medium text-slate-600 dark:text-slate-400">
                                          Item
                                        </th>
                                        <th className="pb-2 text-left font-medium text-slate-600 dark:text-slate-400">
                                          Qty
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {receiptDetails.lines.map((line) => (
                                        <tr
                                          key={line.id}
                                          className="border-b border-slate-100 dark:border-slate-700/50"
                                        >
                                          <td className="py-1.5 pr-4 text-slate-800 dark:text-white">
                                            {line.itemName}
                                          </td>
                                          <td className="py-1.5 text-left tabular-nums text-slate-600 dark:text-slate-300">
                                            {line.qty}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  No line items
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalElements > 0 && (
            <div className="mt-4 flex justify-end">
              <div
                className="sales-total-chip inline-flex flex-col items-end gap-0.5 rounded-2xl border border-slate-200/90 bg-white px-5 py-3 shadow-md ring-1 ring-slate-200/50 hover:shadow-lg dark:border-slate-600/70 dark:bg-slate-800 dark:ring-slate-700/50 dark:hover:shadow-black/30"
                aria-label={`Total sales for selected range: ${formatCurrency(totalSalesSum)}`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total sales
                </span>
                <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalSalesSum)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
