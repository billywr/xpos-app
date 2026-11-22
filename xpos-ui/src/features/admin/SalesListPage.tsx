import { Fragment, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { useAdminContextSelection } from "@/hooks/useAdminContextSelection";
import { useTableCustomization } from "@/contexts/TableCustomizationContext";
import {
  fetchAdminSales,
  type SaleSummary,
  type FetchAdminSalesParams,
} from "@/api/adminSales";
import { fetchReceiptDetails } from "@/api/sales";
import type { Branch } from "@/types/org";
import {
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  TableSearchInput,
  TableSkeleton,
  StatChip,
  tableBodyRow,
  tableStickyFirstCell,
  tableHeadCell,
  tableBodyCell,
  tableBodyCellNum,
  tableEmptyCell,
  DateInput,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatCurrency, formatAmount } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";
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

export interface SalesListPageProps {
  initialOrgId?: string;
  initialBranchId?: string;
}

export function SalesListPage({ initialOrgId, initialBranchId }: SalesListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const {
    selectedOrgId,
    setSelectedOrgId,
    selectedBranchId,
    setSelectedBranchId,
    orgs,
    branches,
    orgSelectOptions,
    branchSelectOptions,
  } = useAdminContextSelection({ initialOrgId, initialBranchId });
  const tableCustom = useTableCustomization("sales");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(tableCustom.pageSize || DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (tableCustom.pageSize) {
      setSize(tableCustom.pageSize);
    }
  }, [tableCustom.pageSize]);

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const [fromDate, setFromDate] = useState<string>(toDateStr(defaultFrom));
  const [toDate, setToDate] = useState<string>(toDateStr(today));
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const params: FetchAdminSalesParams = {
    page,
    size,
    status: "COMPLETED",
    fromDate,
    toDate,
  };

  const salesQuery = useQuery({
    queryKey: ["admin-sales", token, selectedOrgId, selectedBranchId, params],
    queryFn: () =>
      fetchAdminSales(token, selectedOrgId, selectedBranchId, params),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });
  const { data: salesData, isError, error, refetch } = salesQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(salesQuery);

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

  const visibleSalesColCount =
    (tableCustom.showRowNumbers ? 1 : 0) + tableCustom.visibleColumns.length;

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

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  const selectedBranch = branches.find((b: Branch) => b.id === selectedBranchId);

  return (
    <div className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
            <Receipt className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
            Sales
          </h1>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        {orgs.length > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="sales-org-select"
              className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300"
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
        )}
        {branches.length > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="sales-branch-select"
              className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300"
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
        )}
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            From
          </span>
          <DateInput
            id="sales-from-date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            To
          </span>
          <DateInput
            id="sales-to-date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </label>
        {selectedOrgId && selectedBranchId && (
          <TableSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search sales…"
            className="w-full sm:w-64 [&_input]:py-2"
          />
        )}
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization and branch to view sales.
        </div>
      ) : (
        <>
          {isError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              <p>{getApiErrorMessage(error)}</p>
              {getApiErrorRequestId(error) && (
                <p className="mt-2 text-sm opacity-90">
                  Reference:{" "}
                  <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                    {getApiErrorRequestId(error)}
                  </code>
                </p>
              )}
            </div>
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "600px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    {tableCustom.showRowNumbers && (
                      <TableRowNumberHead className={tableCustom.densityStyles.th} />
                    )}
                    {tableCustom.visibleColumns.map((col) => {
                      const isActions = col.key === "actions";
                      return (
                        <SortableTableHead
                          key={col.key}
                          columnKey={col.key}
                          label={isActions ? "" : col.label}
                          align={col.align}
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={toggleSort}
                          sortable={col.sortable}
                          className={`${isActions ? "sticky left-0 z-20 w-10 bg-slate-50 px-4 py-3 sm:py-3 dark:bg-slate-700" : tableHeadCell} ${tableCustom.densityStyles.th}`}
                        />
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {isInitialLoad ? (
                    <TableSkeleton rows={10} columns={visibleSalesColCount} />
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleSalesColCount}
                        className={tableEmptyCell}
                      >
                        {sales.length === 0 ? `No completed sales for ${selectedBranch?.name ?? "this branch"} in the selected date range.` : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale: SaleSummary, index) => {
                      const isEven = index % 2 === 1;
                      const zebraClass =
                        tableCustom.zebraStriping && isEven
                          ? "bg-slate-50/60 dark:bg-slate-700/20"
                          : "";
                      return (
                        <Fragment key={sale.id}>
                          <tr
                            key={sale.id}
                            className={`${tableBodyRow} ${zebraClass}`}
                          >
                            {tableCustom.showRowNumbers && (
                              <TableRowNumberCell
                                page={page}
                                pageSize={size}
                                indexInPage={index}
                                className={tableCustom.densityStyles.td}
                              />
                            )}
                            {tableCustom.visibleColumns.map((col) => {
                              switch (col.key) {
                                case "actions":
                                  return (
                                    <td
                                      key={col.key}
                                      className={`${tableStickyFirstCell} w-10 px-4 py-2 sm:py-2.5 ${tableCustom.densityStyles.td}`}
                                    >
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
                                  );
                                case "receiptNumber":
                                  return (
                                    <td
                                      key={col.key}
                                      className={`${tableBodyCell} font-mono font-semibold text-slate-700 dark:text-slate-300 ${tableCustom.densityStyles.td}`}
                                    >
                                      {sale.receiptNumber ?? "—"}
                                    </td>
                                  );
                                case "completedAt":
                                  return (
                                    <td
                                      key={col.key}
                                      className={`${tableBodyCell} ${tableCustom.densityStyles.td}`}
                                    >
                                      {formatDateTime(sale.completedAt)}
                                    </td>
                                  );
                                case "cashier":
                                  return (
                                    <td
                                      key={col.key}
                                      className={`${tableBodyCell} ${tableCustom.densityStyles.td}`}
                                    >
                                      {sale.createdByUsername ?? "—"}
                                    </td>
                                  );
                                case "total":
                                  return (
                                    <td
                                      key={col.key}
                                      className={`${tableBodyCellNum} ${tableCustom.densityStyles.td}`}
                                    >
                                      {formatAmount(sale.total)}
                                    </td>
                                  );
                                default:
                                  return null;
                              }
                            })}
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
                    );
                  })
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
                onSizeChange={handleSizeChange}
                sizeOptions={[10, 25, 50, 100]}
                onRefresh={() => void refetch()}
                isRefreshing={isRefreshing}
              />
            )}
          </div>

          {totalElements > 0 && (
            <div className="mt-4 flex justify-end">
              <StatChip
                label="Total sales"
                value={formatCurrency(totalSalesSum)}
                tone="neutral"
                className="items-end text-right"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
