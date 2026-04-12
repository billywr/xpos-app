import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { PageHeader } from "@/components/PageHeader";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
  selectOrgName,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchStdStockCountSheet,
  saveStdStockCount,
  type StdStockCountRowResponse,
} from "@/api/stdStockCount";
import { fetchOperatorAnalyticsSnapshot } from "@/api/operatorAnalytics";
import { fetchDebts } from "@/api/debts";
import { formatCurrency } from "@/utils/formatCurrency";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { APP_NAME_KEY } from "@/config/headerNavItems";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Save,
  Loader2,
  FileSpreadsheet,
  Download,
  X,
} from "lucide-react";
import { downloadStdStockCountPdf } from "@/utils/stdStockCountPdf";
import { Pagination, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";

/** YYYY-MM-DD in the browser's local calendar (not UTC). toISOString().slice(0,10) is wrong for TZ ahead of UTC. */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayStr(): string {
  return toDateStr(new Date());
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

interface ComputedRow {
  itemId: string;
  sku: string;
  name: string;
  openingStock: number;
  addedStock: number;
  addedTodayStock: number;
  totalStock: number;
  closingStock: number;
  systemCountBeforeToday: number;
  variance: number;
  unitsSold: number;
  sellingPrice: number;
  amount: number;
  comments: string;
  lastSavedAt: string | null;
  closingError?: string;
}

/** Saved closing if present; otherwise ledger on-hand (same as System column). */
function defaultClosingFromRow(row: StdStockCountRowResponse): number {
  return row.closingStock ?? row.systemCountBeforeToday ?? 0;
}

function computeRow(
  row: StdStockCountRowResponse,
  localClosing: number | undefined,
  localComment: string | undefined
): ComputedRow {
  const closing = localClosing ?? defaultClosingFromRow(row);
  const total =
    row.openingStock + row.addedStock + (row.addedTodayStock ?? 0);
  const systemCount = row.systemCountBeforeToday ?? 0;
  const variance = closing - systemCount;
  const unitsSold = Math.max(0, total - closing);
  const amount = unitsSold * (row.sellingPrice ?? 0);
  const comments =
    localComment !== undefined ? localComment : (row.comments ?? "");

  let closingError: string | undefined;
  if (closing < 0) {
    closingError = "Must be ≥ 0";
  } else if (closing > total) {
    closingError = "Cannot exceed total stock";
  }

  return {
    itemId: row.itemId,
    sku: row.sku,
    name: row.name,
    openingStock: row.openingStock,
    addedStock: row.addedStock,
    addedTodayStock: row.addedTodayStock,
    totalStock: total,
    closingStock: closing,
    systemCountBeforeToday: systemCount,
    variance,
    unitsSold,
    sellingPrice: row.sellingPrice,
    amount,
    comments,
    lastSavedAt: row.lastSavedAt,
    closingError,
  };
}

export interface StandardStockCountSheetPageProps {
  /** When true, show System and Variance columns (admin only) */
  showSystemAndVariance?: boolean;
  /** Override org context (for admin) */
  orgId?: string;
  /** Override branch context (for admin) */
  branchId?: string;
  branchName?: string;
  orgName?: string;
}

export function StandardStockCountSheetPage({
  showSystemAndVariance = false,
  orgId: orgIdProp,
  branchId: branchIdProp,
  branchName: branchNameProp,
  orgName: orgNameProp,
}: StandardStockCountSheetPageProps = {}) {
  const token = useAppSelector(selectToken);
  const contextOrgId = useAppSelector(selectOrgId) ?? "";
  const contextBranchId = useAppSelector(selectBranchId) ?? "";
  const contextBranchName = useAppSelector(selectBranchName);
  const contextOrgName = useAppSelector(selectOrgName);

  const orgId = orgIdProp ?? contextOrgId;
  const branchId = branchIdProp ?? contextBranchId;
  const branchName = branchNameProp ?? contextBranchName;
  const orgName = orgNameProp ?? contextOrgName;
  const queryClient = useQueryClient();
  const toast = useToast();
  const navVisibility = useNavVisibilityContextOrNull();
  const appName = navVisibility
    ? navVisibility.getHeaderLabel(APP_NAME_KEY, "XPOS")
    : "XPOS";

  const [dateStr, setDateStr] = useState(todayStr);
  const [localClosings, setLocalClosings] = useState<Record<string, string>>({});
  const [localComments, setLocalComments] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [debtModal, setDebtModal] = useState<"day" | "all" | null>(null);
  const [tableExpanded, setTableExpanded] = useState(false);

  const isToday = dateStr === todayStr();
  const isYesterday = dateStr === yesterdayStr();
  const canEdit = isToday || isYesterday;

  const { data: sheet, isLoading, isError, error } = useQuery({
    queryKey: ["std-stock-count", token, orgId, branchId, dateStr],
    queryFn: () => fetchStdStockCountSheet(token, orgId, branchId, dateStr),
    enabled: Boolean(token && orgId && branchId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: analytics } = useQuery({
    queryKey: ["stock-sheet-analytics", token, orgId, branchId, dateStr],
    queryFn: () =>
      fetchOperatorAnalyticsSnapshot(token, orgId, branchId, dateStr, dateStr),
    enabled: Boolean(token && orgId && branchId),
  });

  // Debts for selected date (today's debts) and all outstanding debts
  const { data: dayDebtsPage } = useQuery({
    queryKey: ["stock-sheet-day-debts", token, orgId, branchId, dateStr],
    queryFn: () =>
      fetchDebts(token, orgId, branchId, {
        page: 0,
        size: 500,
        status: ["OPEN", "PARTIAL"],
        fromDate: dateStr,
        toDate: dateStr,
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  const { data: allDebtsPage } = useQuery({
    queryKey: ["stock-sheet-all-debts", token, orgId, branchId],
    queryFn: () =>
      fetchDebts(token, orgId, branchId, {
        page: 0,
        size: 500,
        status: ["OPEN", "PARTIAL"],
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  const dayDebts = dayDebtsPage?.content ?? [];
  const allDebts = allDebtsPage?.content ?? [];
  const dayDebtsTotal = dayDebts.reduce((s, d) => s + (d.outstanding ?? 0), 0);
  const allDebtsTotal = allDebts.reduce((s, d) => s + (d.outstanding ?? 0), 0);

  function parseClosing(itemId: string, row: StdStockCountRowResponse): number {
    const s = localClosings[itemId];
    if (s === undefined) return defaultClosingFromRow(row);
    if (s === "") return 0;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function parseCommentForSave(itemId: string, row: StdStockCountRowResponse): string {
    const s = localComments[itemId];
    if (s !== undefined) return s;
    return row.comments ?? "";
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const rows = sheet?.rows ?? [];
      const counts = rows.map((r) => ({
        itemId: r.itemId,
        closingStock: parseClosing(r.itemId, r),
        comments: parseCommentForSave(r.itemId, r),
      }));
      return saveStdStockCount(token, orgId, branchId, {
        date: dateStr,
        outletId: branchId,
        counts,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["std-stock-count"] });
      setLocalClosings({});
      setLocalComments({});
      toast.success("Stock count saved.", { title: "Saved" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const allComputedRows = useMemo(() => {
    const rows = sheet?.rows ?? [];
    return rows.map((r) =>
      computeRow(
        r,
        localClosings[r.itemId] !== undefined ? parseClosing(r.itemId, r) : undefined,
        localComments[r.itemId] !== undefined ? localComments[r.itemId] : undefined
      )
    );
  }, [sheet?.rows, localClosings, localComments]);

  const { searchQuery, setSearchQuery, filteredRows: computedRows } = useTableSearch(allComputedRows);

  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return computedRows.slice(start, start + pageSize);
  }, [computedRows, page, pageSize]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(computedRows.length / pageSize) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [computedRows.length, pageSize]);

  const totals = useMemo(() => {
    return computedRows.reduce(
      (acc, r) => ({
        unitsSold: acc.unitsSold + r.unitsSold,
        amount: acc.amount + r.amount,
      }),
      { unitsSold: 0, amount: 0 }
    );
  }, [computedRows]);

  const allRowsForPdf = allComputedRows;

  const pdfTotals = useMemo(
    () =>
      allRowsForPdf.reduce(
        (acc, r) => ({
          unitsSold: acc.unitsSold + r.unitsSold,
          amount: acc.amount + r.amount,
        }),
        { unitsSold: 0, amount: 0 }
      ),
    [allRowsForPdf]
  );

  const hasErrors = computedRows.some((r) => r.closingError);

  const hasChanges = useMemo(() => {
    const rows = sheet?.rows ?? [];
    return rows.some((r) => {
      const closingLocal = localClosings[r.itemId];
      if (closingLocal !== undefined) {
        const parsed = closingLocal === "" ? 0 : (parseInt(closingLocal, 10) || 0);
        const baseline = defaultClosingFromRow(r);
        if (parsed !== baseline) return true;
      }
      const commentLocal = localComments[r.itemId];
      if (commentLocal !== undefined) {
        const baselineComment = r.comments ?? "";
        if (commentLocal !== baselineComment) return true;
      }
      return false;
    });
  }, [sheet?.rows, localClosings, localComments]);

  function handleDownloadPdf() {
    downloadStdStockCountPdf(
      dateStr,
      allRowsForPdf.map((r) => ({
        sku: r.sku,
        name: r.name,
        openingStock: r.openingStock,
        addedStock: r.addedStock,
        totalStock: r.totalStock,
        closingStock: r.closingStock,
        systemCountBeforeToday: r.systemCountBeforeToday,
        variance: r.variance,
        unitsSold: r.unitsSold,
        sellingPrice: r.sellingPrice,
        amount: r.amount,
        comments: r.comments,
      })),
      pdfTotals,
      branchName,
      orgName,
      showSystemAndVariance,
      appName,
      {
        dayDebts: dayDebts.map((d) => ({
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          outstanding: d.outstanding,
          dueDate: d.dueDate,
          createdAt: d.createdAt,
        })),
        dayDebtsTotal,
        allDebts: allDebts.map((d) => ({
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          outstanding: d.outstanding,
          dueDate: d.dueDate,
          createdAt: d.createdAt,
        })),
        allDebtsTotal,
        expensesTotal: analytics?.expenseIntelligence?.todayTotal ?? 0,
      }
    );
    toast.success("PDF downloaded.", { title: "Stock Count Sheet" });
  }

  function goPrevDay() {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    setDateStr(toDateStr(d));
  }

  function goNextDay() {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    setDateStr(toDateStr(d));
  }

  function handleClosingChange(itemId: string, value: string) {
    if (value === "" || /^\d+$/.test(value)) {
      setLocalClosings((prev) => ({ ...prev, [itemId]: value }));
    }
  }

  function handleCommentChange(itemId: string, value: string) {
    if (value.length <= 2000) {
      setLocalComments((prev) => ({ ...prev, [itemId]: value }));
    }
  }

  // Auto-save with 1.5s debounce after edits
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doAutoSave = useCallback(() => {
    if (!hasErrors && canEdit && hasChanges && !saveMutation.isPending) {
      saveMutation.mutate();
    }
  }, [hasErrors, canEdit, hasChanges, saveMutation]);

  useEffect(() => {
    if (!hasChanges || hasErrors || !canEdit) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(doAutoSave, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [localClosings, localComments, hasChanges, hasErrors, canEdit, doAutoSave]);

  function handleSave() {
    if (hasErrors) {
      toast.error("Fix validation errors before saving.");
      return;
    }
    saveMutation.mutate();
  }

  if (!orgId || !branchId) {
    return (
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-400">
          Select organization and branch context for the stock count sheet.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden ${tableExpanded ? "fixed inset-0 z-40 bg-white p-2 dark:bg-slate-900" : "min-h-0 flex-1 p-6"}`}>
      {!tableExpanded && (
        <PageHeader
          title="Stock Count Sheet"
          subtitle={`Bar-style sheet at ${branchName ?? "this branch"}. Opening = previous day's saved Closing when you saved the sheet; if none, ledger fallback (max(0, System − same-day Added and stock-take adds)). Total Stock = Opening + Added + Added today. Closing = physical count (defaults to ledger on-hand; editable); Units Sold = Total Stock − Closing.${showSystemAndVariance ? " System = ledger at end of this day; Variance = Closing − System (positive = excess)." : ""}`}
          subtitleRevealOnTitleHover
          icon={FileSpreadsheet}
          fallbackTo="/operator"
        />
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {sheet ? (
          <div className="flex min-w-0 items-center gap-2">
            <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Filter by name or SKU" />
            {sheet.rows[0]?.lastSavedAt && (
              <span className="hidden shrink-0 text-xs text-slate-500 md:inline dark:text-slate-400">
                Saved: {new Date(sheet.rows[0].lastSavedAt).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
          <button
            type="button"
            onClick={goPrevDay}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <DatePicker
            selected={dateStr ? parseDateStr(dateStr) : null}
            onChange={(d: Date | null) => setDateStr(d ? toDateStr(d) : todayStr())}
            maxDate={new Date()}
            dateFormat="dd/MM/yyyy"
            showPopperArrow={false}
            placeholderText="Select date"
            className="w-[6.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 sm:w-32 sm:px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button"
            onClick={goNextDay}
            disabled={isToday}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="mx-0.5 hidden h-4 w-px bg-slate-300 sm:mx-1 sm:block dark:bg-slate-600" aria-hidden />
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!sheet}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:gap-2 sm:px-4 sm:py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Download PDF"
          >
            <Download className="h-4 w-4" />
            <span className="hidden xs:inline">PDF</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || hasErrors || !canEdit || !hasChanges}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 sm:gap-2 sm:px-4 sm:py-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden xs:inline">Save</span>
          </button>
          <button
            type="button"
            onClick={() => setTableExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:gap-2 sm:px-4 sm:py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title={tableExpanded ? "Exit full screen" : "Expand table"}
            aria-label={tableExpanded ? "Exit full screen" : "Expand table"}
          >
            {tableExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!canEdit && !tableExpanded && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Viewing past date. Edits are disabled; only today and yesterday are
          editable (yesterday for testing).
        </p>
      )}

      {isLoading && (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      )}

      {isError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      )}

      {!isLoading && !isError && sheet && (
        <>
          {/* Swipe hint — visible only on small screens */}
          {computedRows.length > 0 && (
            <Pagination
              position="top"
              page={page}
              size={pageSize}
              totalElements={computedRows.length}
              onPageChange={setPage}
              onSizeChange={(s) => {
                setPageSize(s);
                setPage(0);
              }}
              sizeOptions={[10, 25, 50, 100]}
            />
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">
            ← swipe table to see all columns →
          </p>
          <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="relative max-h-[55vh] min-h-0 overflow-auto">
              {/* Gradient fade on right edge */}
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "600px" }}>
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/80">
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-slate-50 px-2 py-2 text-left text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:bg-slate-700/80 dark:text-slate-300"
                    title="Product name"
                  >
                    Item
                  </th>
                  <th
                    className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Previous business day's saved closing, or ledger fallback if that day was not saved"
                  >
                    Open
                  </th>
                  <th
                    className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Received today per receipt date (sum of current GRN lines; edits apply immediately)"
                  >
                    Added
                  </th>
                  <th
                    className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Opening + Added + stock-take adds; equals System when counts align with the ledger"
                  >
                    Total
                  </th>
                  <th
                    className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Physical count at end of day"
                  >
                    Close
                  </th>
                  {showSystemAndVariance && (
                    <>
                      <th
                        className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                        title="Ledger on-hand at end of this day (from stock movements; excludes later receipts)"
                      >
                        Sys
                      </th>
                      <th
                        className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                        title="Closing count minus ledger on-hand (positive = physical excess, negative = short)"
                      >
                        Var
                      </th>
                    </>
                  )}
                  <th
                    className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Total Stock − Closing (units sold)"
                  >
                    Sold
                  </th>
                  <th
                    className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Selling price per unit from price list"
                  >
                    Price
                  </th>
                  <th
                    className="px-2 py-2 text-right text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Units Sold × Selling Price (revenue value)"
                  >
                    Amt
                  </th>
                  <th
                    className="px-2 py-2 text-left text-xs font-medium text-slate-700 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300"
                    title="Notes saved with this count line"
                  >
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {paginatedRows.map((r) => (
                  <tr
                    key={r.itemId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs font-bold text-slate-900 sm:px-3 sm:py-2 sm:text-sm dark:bg-slate-800 dark:text-white">
                      {r.name || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                      {r.openingStock}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                      {r.addedStock}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                      {r.totalStock}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                      {canEdit ? (
                        <div className="flex flex-col items-end">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={
                              r.itemId in localClosings
                                ? localClosings[r.itemId]
                                : String(r.closingStock ?? "")
                            }
                            onChange={(e) =>
                              handleClosingChange(r.itemId, e.target.value)
                            }
                            className={`w-12 rounded border px-1 py-0.5 text-right text-xs tabular-nums sm:w-16 sm:px-2 sm:py-1 sm:text-sm ${
                              r.closingError
                                ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/20"
                                : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                            } text-slate-900 dark:text-white`}
                          />
                          {r.closingError && (
                            <span className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                              {r.closingError}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-right text-xs tabular-nums sm:text-sm">
                          {r.closingStock}
                        </span>
                      )}
                    </td>
                    {showSystemAndVariance && (
                      <>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                          {r.systemCountBeforeToday}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right text-xs tabular-nums sm:px-3 sm:py-2 sm:text-sm ${
                            r.variance > 0
                              ? "font-medium text-emerald-600 dark:text-emerald-400"
                              : r.variance < 0
                                ? "font-medium text-red-600 dark:text-red-400"
                                : "text-slate-700 dark:text-slate-300"
                          }`}
                          title={
                            r.variance > 0
                              ? "Physical count exceeds ledger on-hand"
                              : r.variance < 0
                                ? "Physical count below ledger on-hand"
                                : undefined
                          }
                        >
                          {r.variance > 0 ? "+" : ""}
                          {r.variance}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                      {r.unitsSold}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                      {formatCurrency(r.sellingPrice)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums font-medium text-slate-900 sm:px-3 sm:py-2 sm:text-sm dark:text-white">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="px-2 py-1.5 align-top sm:px-3 sm:py-2">
                      {canEdit ? (
                        <textarea
                          value={r.comments}
                          onChange={(e) =>
                            handleCommentChange(r.itemId, e.target.value)
                          }
                          rows={2}
                          maxLength={2000}
                          className="w-full min-w-[5rem] max-w-[18rem] resize-y rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:min-w-[8rem] sm:px-2 sm:py-1 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                          placeholder="Notes…"
                          aria-label={`comments for ${r.name}`}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                          {r.comments.trim() ? r.comments : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className={`mt-4 flex flex-wrap justify-end gap-1.5 sm:gap-3 ${tableExpanded ? "hidden" : ""}`}>
            {/* Today's Debts badge */}
            <button
              type="button"
              onClick={() => dayDebts.length > 0 && setDebtModal("day")}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-1.5 py-1 shadow ring-2 ring-amber-100/50 transition hover:shadow-xl active:scale-[0.98] sm:gap-3 sm:rounded-xl sm:px-6 sm:py-4 dark:border-amber-800 dark:from-amber-950/50 dark:to-orange-950/50 dark:ring-amber-900/30"
            >
              <span className="text-[8px] font-medium uppercase tracking-wide text-amber-700 sm:text-base dark:text-amber-400">
                Today Debts
              </span>
              <span className="text-xs font-bold tabular-nums text-amber-900 sm:text-2xl dark:text-amber-100">
                {formatCurrency(dayDebtsTotal)}
              </span>
            </button>
            {/* Total Debts badge */}
            <button
              type="button"
              onClick={() => allDebts.length > 0 && setDebtModal("all")}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 px-1.5 py-1 shadow ring-2 ring-orange-100/50 transition hover:shadow-xl active:scale-[0.98] sm:gap-3 sm:rounded-xl sm:px-6 sm:py-4 dark:border-orange-800 dark:from-orange-950/50 dark:to-amber-950/50 dark:ring-orange-900/30"
            >
              <span className="text-[8px] font-medium uppercase tracking-wide text-orange-700 sm:text-base dark:text-orange-400">
                Total Debts
              </span>
              <span className="text-xs font-bold tabular-nums text-orange-900 sm:text-2xl dark:text-orange-100">
                {formatCurrency(allDebtsTotal)}
              </span>
            </button>
            <div
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 px-1.5 py-1 shadow ring-2 ring-red-100/50 sm:gap-3 sm:rounded-xl sm:px-6 sm:py-4 dark:border-red-800 dark:from-red-950/50 dark:to-rose-950/50 dark:ring-red-900/30"
              role="status"
            >
              <span className="text-[8px] font-medium uppercase tracking-wide text-red-700 sm:text-base dark:text-red-400">
                Expenses
              </span>
              <span className="text-xs font-bold tabular-nums text-red-900 sm:text-2xl dark:text-red-100">
                {formatCurrency(analytics?.expenseIntelligence?.todayTotal ?? 0)}
              </span>
            </div>
            <div
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-1.5 py-1 shadow ring-2 ring-emerald-100/50 sm:gap-3 sm:rounded-xl sm:px-6 sm:py-4 dark:border-emerald-800 dark:from-emerald-950/50 dark:to-teal-950/50 dark:ring-emerald-900/30"
              role="status"
            >
              <span className="text-[8px] font-medium uppercase tracking-wide text-emerald-700 sm:text-base dark:text-emerald-400">
                Total Sales
              </span>
              <span className="text-xs font-bold tabular-nums text-emerald-900 sm:text-2xl dark:text-emerald-100">
                {formatCurrency(totals.amount)}
              </span>
            </div>
          </div>

          {computedRows.length === 0 && (
            <p className="mt-4 text-center text-slate-500 dark:text-slate-400">
              No items in price list for this branch. Add items to a price list
              and assign it to the branch.
            </p>
          )}
        </>
      )}

      {/* Debtors modal */}
      {debtModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setDebtModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {debtModal === "day" ? `Debtors — ${dateStr}` : "All Outstanding Debtors"}
              </h3>
              <button
                type="button"
                onClick={() => setDebtModal(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {(debtModal === "day" ? dayDebts : allDebts).length === 0 ? (
                <p className="py-6 text-center text-slate-500 dark:text-slate-400">No debtors</p>
              ) : (
                <div className="space-y-2">
                  {(debtModal === "day" ? dayDebts : allDebts).map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-700/50">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white">{d.customerName}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {d.customerPhone ?? "—"} · Due: {d.dueDate ?? "—"}
                          {debtModal === "all" ? ` · Recorded: ${d.createdAt?.slice(0, 10) ?? "—"}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 text-lg font-bold tabular-nums ${debtModal === "day" ? "text-amber-600 dark:text-amber-400" : "text-orange-600 dark:text-orange-400"}`}>
                        {formatCurrency(d.outstanding)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-right dark:border-slate-700">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Total: {formatCurrency(debtModal === "day" ? dayDebtsTotal : allDebtsTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
