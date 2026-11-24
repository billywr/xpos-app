import { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchOperatorReceipts,
  fetchReceiptDetails,
  recordReceiptReprint,
  refundSale,
  type SaleSummary,
} from "@/api/sales";
import { ReceiptModal } from "@/components/ReceiptModal";
import {
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  TableSearchInput,
  TableSkeleton,
  tableBodyRow,
  tableStickyHeadCell,
  tableHeadCell,
  tableBodyCell,
  tableStickyFirstBody,
  tableEmptyCell,
  tableBodyCellNum,
  DateInput,
} from "@/components/ui";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
import { formatAmount } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { invalidateInventoryQueries } from "@/utils/invalidateInventoryQueries";
import {
  getStoredTablePageSize,
  setStoredTablePageSize,
} from "@/utils/tablePaginationStorage";
import { Receipt, Printer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const DEFAULT_PAGE_SIZE = 20;
const RECEIPT_SORT = {
  receiptNumber: (row: SaleSummary) => row.receiptNumber ?? "",
  completedAt: (row: SaleSummary) => row.completedAt ?? "",
  total: (row: SaleSummary) => row.total,
  staff: (row: SaleSummary) => row.createdByUsername ?? "",
};

/** Local date as YYYY-MM-DD for date inputs. Ensures "today" respects user timezone. */
function getTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReceiptsPage() {
  const location = useLocation();
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const queryClient = useQueryClient();
  const toast = useToast();

  const fallbackTo = location.pathname.startsWith("/admin") ? "/admin" : "/operator";
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(() =>
    getStoredTablePageSize("receipts", DEFAULT_PAGE_SIZE, [10, 20, 50])
  );
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [receiptDetails, setReceiptDetails] = useState<import("@/types/sales").ReceiptDetailResponse | null>(null);
  const [reprintingSaleId, setReprintingSaleId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "operator-receipts",
      token,
      orgId,
      branchId,
      page,
      size,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      fetchOperatorReceipts(token, orgId!, branchId!, {
        page,
        size,
        fromDate,
        toDate,
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  const reprintMutation = useMutation({
    mutationFn: (saleId: string) =>
      recordReceiptReprint(token, orgId!, branchId!, saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-receipts", token, orgId, branchId],
      });
      setReceiptDetails(null);
      setReprintingSaleId(null);
      toast.success("Reprint recorded.", { title: "Receipt" });
    },
    onError: (err) => {
      setReprintingSaleId(null);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const refundMutation = useMutation({
    mutationFn: (saleId: string) =>
      refundSale(token, orgId!, branchId!, saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-receipts", token, orgId, branchId],
      });
      void invalidateInventoryQueries(queryClient);
      setReceiptDetails(null);
      setReprintingSaleId(null);
      toast.success("Sale refunded. Items returned to stock.", {
        title: "Refund",
      });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const receipts = data?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredReceipts,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: receipts,
    serverTotalElements: data?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: [
      "operator-receipts",
      token,
      orgId,
      branchId,
      fromDate,
      toDate,
    ],
    searchAllQueryFn: (fetchSize) =>
      fetchOperatorReceipts(token, orgId!, branchId!, {
        page: 0,
        size: fetchSize,
        fromDate,
        toDate,
      }),
    searchAllEnabled: Boolean(token && orgId && branchId),
    sortAccessors: RECEIPT_SORT,
  });

  const showCompletedCol = useMemo(
    () => filteredReceipts.some((s: SaleSummary) => !!s.completedAt),
    [filteredReceipts]
  );
  const showStaffCol = useMemo(
    () =>
      filteredReceipts.some(
        (s: SaleSummary) =>
          !!s.createdByUsername &&
          s.createdByUsername.trim() !== "" &&
          s.createdByUsername !== "—"
      ),
    [filteredReceipts]
  );
  const visibleReceiptsColCount =
    4 + (showCompletedCol ? 1 : 0) + (showStaffCol ? 1 : 0);

  const handleReprint = async (sale: SaleSummary) => {
    if (!orgId || !branchId) return;
    setReprintingSaleId(sale.id);
    try {
      const details = await fetchReceiptDetails(
        token,
        orgId,
        branchId,
        sale.terminalId,
        sale.id
      );
      setReceiptDetails(details);
    } catch (err) {
      setReprintingSaleId(null);
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleCloseReceiptModal = () => {
    setReceiptDetails(null);
    setReprintingSaleId(null);
  };

  if (!orgId || !branchId) {
    return (
      <div className="p-6">
        <p className="text-slate-500 dark:text-slate-400">
          Select organization and branch to view receipts.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <PageHeader
        title="Receipts"
        subtitle={`View and reprint receipts for ${branchName ?? "this branch"}.`}
        icon={Receipt}
        fallbackTo={fallbackTo}
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            From
          </span>
          <DateInput
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            To
          </span>
          <DateInput
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </label>
      </div>

      {isError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      ) : (
        <>
        <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search receipts…" className="mb-4" />
        <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">&larr; swipe table to see all columns &rarr;</p>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
            <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "600px" }}>
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <TableRowNumberHead />
                  <SortableTableHead
                    columnKey="receiptNumber"
                    label="Receipt"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={`${tableStickyHeadCell} ${tableHeadCell}`}
                  />
                  {showCompletedCol && (
                    <SortableTableHead
                      columnKey="completedAt"
                      label="Completed"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                  )}
                  <SortableTableHead
                      align="right"
                    columnKey="total"
                    label="Total"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                  />
                  {showStaffCol && (
                    <SortableTableHead
                      columnKey="staff"
                      label="Staff"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                  )}
                  <SortableTableHead
                    columnKey="actions"
                    label="Actions"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    sortable={false}
                    className={tableHeadCell}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {isLoading && receipts.length === 0 ? (
                  <TableSkeleton rows={10} columns={visibleReceiptsColCount} />
                ) : filteredReceipts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleReceiptsColCount}
                      className={tableEmptyCell}
                    >
                      {receipts.length === 0 ? "No receipts for this date range." : "No results match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((sale, index) => (
                    <tr
                      key={sale.id}
                      className={tableBodyRow}
                    >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                      <td className={tableStickyFirstBody}>
                        #{sale.receiptNumber ?? "—"}
                      </td>
                      {showCompletedCol && (
                        <td className={tableBodyCell}>
                          {formatDateTime(sale.completedAt)}
                        </td>
                      )}
                      <td className={`${tableBodyCellNum} font-semibold text-slate-700 dark:text-slate-300`}>
                        {formatAmount(sale.total)}
                      </td>
                      {showStaffCol && (
                        <td className={tableBodyCell}>
                          {sale.createdByUsername ?? "—"}
                        </td>
                      )}
                      <td className={tableBodyCell}>
                        <button
                          type="button"
                          onClick={() => handleReprint(sale)}
                          disabled={reprintingSaleId === sale.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
                        >
                          <Printer className="h-4 w-4" />
                          {reprintingSaleId === sale.id ? "Loading…" : "Reprint"}
                        </button>
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
                setStoredTablePageSize(s, "receipts");
                setPage(0);
              }}
              storageKey="receipts"
              sizeOptions={[10, 20, 50]}
              onRefresh={() => void refetch()}
              isRefreshing={isFetching}
            />
          )}
        </div>
        </>
      )}

      {receiptDetails && (
        <ReceiptModal
          receipt={receiptDetails}
          onClose={handleCloseReceiptModal}
          shopName={branchName ?? ""}
          saleId={reprintingSaleId ?? undefined}
          onRefund={(sid) => refundMutation.mutate(sid)}
          isRefunding={refundMutation.isPending}
          onPrintComplete={() => {
            if (reprintingSaleId) reprintMutation.mutate(reprintingSaleId);
          }}
        />
      )}
    </div>
  );
}
