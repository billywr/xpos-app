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
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchStdStockCountSheet,
  saveStdStockCount,
  fetchStdStockCountSalesPreview,
  recordStdStockCountSales,
  type StdStockCountRowResponse,
  type StdStockCountSalesPreviewResponse,
} from "@/api/stdStockCount";
import { fetchOperatorAnalyticsSnapshot } from "@/api/operatorAnalytics";
import { fetchDebts } from "@/api/debts";
import { formatCurrency, formatAmount } from "@/utils/formatCurrency";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { invalidateInventoryQueries } from "@/utils/invalidateInventoryQueries";
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
  ShoppingBag,
} from "lucide-react";
import { downloadStdStockCountPdf } from "@/utils/stdStockCountPdf";
import {
  Button,
  Modal,
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  StatChip,
  TableSearchInput,
  TableSkeleton,
  ConfirmDialog,
  tableHeadCell,
  tableBodyCell,
  tableBodyCellNumDebts,
  tableBodyRow,
  tableStickyFirstBody,
  tableStickyHeadCell,
  tableCard,
} from "@/components/ui";
import { SlideOver } from "@/components/ui/SlideOver";
import { useDataTable } from "@/hooks/useDataTable";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";

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
  unitsSold: number;
  sellingPrice: number;
  amount: number;
  comments: string;
  lastSavedAt: string | null;
  closingError?: string;
  /** Saved closing is below total after stock receipt; pending auto-sync save. */
  closingStale?: boolean;
}

const STANDARD_STOCK_SORT = {
  item: (row: ComputedRow) => row.name,
  open: (row: ComputedRow) => row.openingStock,
  added: (row: ComputedRow) => row.addedStock,
  total: (row: ComputedRow) => row.totalStock,
  close: (row: ComputedRow) => row.closingStock,
  sold: (row: ComputedRow) => row.unitsSold,
  price: (row: ComputedRow) => row.sellingPrice,
  amount: (row: ComputedRow) => row.amount,
};

/** Saved closing is stale when stock arrived after last save and closing still equals opening. */
function isStaleSavedClosing(row: StdStockCountRowResponse): boolean {
  if (row.closingStock == null || !row.lastSavedAt) return false;
  const total = totalStockFromRow(row);
  return row.closingStock < total && row.closingStock === row.openingStock;
}

interface AutoSyncClosingContext {
  addedIncreased: boolean;
  priorAdded?: number;
}

/** Whether closing should be bumped to total and auto-saved (GRN / cross-tab Added increase). */
function shouldAutoSyncClosing(
  row: StdStockCountRowResponse,
  ctx: AutoSyncClosingContext
): boolean {
  if (isStaleSavedClosing(row)) {
    return true;
  }
  if (!ctx.addedIncreased) {
    return false;
  }
  const total = totalStockFromRow(row);
  const saved = row.closingStock;
  if (saved == null) {
    return true;
  }
  if (saved >= total) {
    return false;
  }
  if (saved === row.openingStock) {
    return true;
  }
  if (ctx.priorAdded !== undefined) {
    const priorTotal =
      row.openingStock + ctx.priorAdded + (row.addedTodayStock ?? 0);
    if (saved === priorTotal) {
      return true;
    }
  }
  return false;
}

function totalStockFromRow(row: StdStockCountRowResponse): number {
  return (
    (row.openingStock ?? 0) +
    (row.addedStock ?? 0) +
    (row.addedTodayStock ?? 0)
  );
}

/** Saved closing if present; otherwise Total stock (Open + Added + AddedToday) so unsaved rows start at "nothing sold yet" and never exceed Total. */
function defaultClosingFromRow(row: StdStockCountRowResponse): number {
  if (row.closingStock !== null && row.closingStock !== undefined) {
    return row.closingStock;
  }
  return totalStockFromRow(row);
}

function computeRow(
  row: StdStockCountRowResponse,
  localClosing: number | undefined,
  localComment: string | undefined
): ComputedRow {
  const closing = localClosing ?? defaultClosingFromRow(row);
  const total =
    row.openingStock + row.addedStock + (row.addedTodayStock ?? 0);
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

  const closingStale =
    isStaleSavedClosing(row) &&
    (localClosing === undefined || closing !== row.closingStock);

  return {
    itemId: row.itemId,
    sku: row.sku,
    name: row.name,
    openingStock: row.openingStock,
    addedStock: row.addedStock,
    addedTodayStock: row.addedTodayStock,
    totalStock: total,
    closingStock: closing,
    unitsSold,
    sellingPrice: row.sellingPrice,
    amount,
    comments,
    lastSavedAt: row.lastSavedAt,
    closingError,
    closingStale,
  };
}

export interface StandardStockCountSheetPageProps {
  /** Override org context (for admin) */
  orgId?: string;
  /** Override branch context (for admin) */
  branchId?: string;
  branchName?: string;
  orgName?: string;
}

export function StandardStockCountSheetPage({
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
  const terminalId = useAppSelector(selectTerminalId);

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
  const [pageSize, setPageSize] = useState(15);
  const [debtModal, setDebtModal] = useState<"day" | "all" | null>(null);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [recordPreview, setRecordPreview] = useState<StdStockCountSalesPreviewResponse | null>(
    null
  );
  const [saveBeforeRecordOpen, setSaveBeforeRecordOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const priorAddedStockSignatureRef = useRef("");

  const isToday = dateStr === todayStr();
  const isYesterday = dateStr === yesterdayStr();
  const canEdit = isToday || isYesterday;

  const sheetQuery = useQuery({
    queryKey: ["std-stock-count", token, orgId, branchId, dateStr],
    queryFn: () => fetchStdStockCountSheet(token, orgId, branchId, dateStr),
    enabled: Boolean(token && orgId && branchId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: sheet, isError, error, refetch } = sheetQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(sheetQuery);

  const salesPreviewQueryEnabled = Boolean(
    token && orgId && branchId && terminalId && canEdit && sheet
  );

  const {
    data: cachedSalesPreview,
    isLoading: salesPreviewLoading,
    isFetched: salesPreviewFetched,
    refetch: refetchSalesPreview,
  } = useQuery({
    queryKey: ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
    queryFn: () => fetchStdStockCountSalesPreview(token, orgId, branchId, dateStr),
    enabled: salesPreviewQueryEnabled,
    staleTime: 30_000,
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
    if (s === "" || s === ".") return 0;
    const n = parseFloat(s);
    if (Number.isNaN(n)) return 0;
    return Math.round(n * 1000) / 1000;
  }

  function parseCommentForSave(itemId: string, row: StdStockCountRowResponse): string {
    const s = localComments[itemId];
    if (s !== undefined) return s;
    return row.comments ?? "";
  }

  function isRowChanged(r: StdStockCountRowResponse): boolean {
    if (localClosings[r.itemId] !== undefined) {
      const parsed = parseClosing(r.itemId, r);
      if (r.closingStock == null) {
        return true;
      }
      if (parsed !== r.closingStock) return true;
    }
    const commentLocal = localComments[r.itemId];
    if (commentLocal !== undefined) {
      const baselineComment = r.comments ?? "";
      if (commentLocal !== baselineComment) return true;
    }
    return false;
  }

  // Save only rows the operator changed — avoids blank zero saves blocking carry-forward.
  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = sheet?.rows ?? [];
      const changedRows = rows.filter((r) => isRowChanged(r));
      if (changedRows.length === 0) {
        return;
      }
      await saveStdStockCount(token, orgId, branchId, {
        date: dateStr,
        outletId: branchId,
        counts: changedRows.map((r) => ({
          itemId: r.itemId,
          closingStock: parseClosing(r.itemId, r),
          comments: parseCommentForSave(r.itemId, r),
        })),
      });
    },
    onSuccess: () => {
      void invalidateInventoryQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
      });
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

  const recordSalesMutation = useMutation({
    mutationFn: async () => {
      if (!terminalId) {
        throw new Error("Select a terminal in context before recording sales.");
      }
      return recordStdStockCountSales(token, orgId, branchId, {
        date: dateStr,
        terminalId,
      });
    },
    onSuccess: (result) => {
      void invalidateInventoryQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
      });
      setRecordPreview(null);
      if (result.saleIds.length === 0) {
        toast.success("No new sales to record — counts already match recorded sales.", {
          title: "Record sales",
        });
      } else {
        toast.success(
          `Recorded ${result.totalItemsRecorded} item(s) · ${formatCurrency(result.totalValue)}`,
          { title: "Sales recorded" }
        );
      }
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

  const {
    searchQuery,
    setSearchQuery,
    filteredRows: paginatedRows,
    allFilteredRows: computedRows,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(allComputedRows, undefined, {
    page,
    size: pageSize,
    setPage,
    sortAccessors: STANDARD_STOCK_SORT,
  });

  const addedStockSignature = useMemo(
    () =>
      (sheet?.rows ?? [])
        .map((r) => `${r.itemId}:${r.addedStock}`)
        .join("|"),
    [sheet]
  );

  useEffect(() => {
    priorAddedStockSignatureRef.current = "";
  }, [dateStr]);

  // After stock receipt (or cross-tab refetch), bump closing to total so auto-save persists carry-forward.
  useEffect(() => {
    const rows = sheet?.rows;
    if (!rows || !canEdit) return;

    const priorAddedByItem = new Map<string, number>();
    if (priorAddedStockSignatureRef.current) {
      for (const part of priorAddedStockSignatureRef.current.split("|")) {
        const colon = part.indexOf(":");
        if (colon === -1) continue;
        priorAddedByItem.set(
          part.slice(0, colon),
          Number(part.slice(colon + 1))
        );
      }
    }

    setLocalClosings((prev) => {
      let next: Record<string, string> | null = null;
      for (const row of rows) {
        if (prev[row.itemId] !== undefined) continue;
        const priorAdded = priorAddedByItem.get(row.itemId);
        const addedIncreased =
          priorAdded !== undefined && row.addedStock > priorAdded;
        if (shouldAutoSyncClosing(row, { addedIncreased, priorAdded })) {
          if (next === null) next = { ...prev };
          next[row.itemId] = String(totalStockFromRow(row));
        }
      }
      return next ?? prev;
    });

    priorAddedStockSignatureRef.current = addedStockSignature;
  }, [sheet, addedStockSignature, canEdit, dateStr]);

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

  // Only block on errors in rows the user is actively editing; stale errors on
  // untouched rows (e.g. a saved closing that exceeds today's Total) are visible
  // but don't block per-row saves.
  const changedItemIds = useMemo(() => {
    const rows = sheet?.rows ?? [];
    const ids = new Set<string>();
    rows.forEach((r) => {
      if (isRowChanged(r)) ids.add(r.itemId);
    });
    return ids;
  }, [sheet?.rows, localClosings, localComments]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasErrors = computedRows.some(
    (r) => changedItemIds.has(r.itemId) && r.closingError
  );

  const hasChanges = changedItemIds.size > 0;

  const hasSalesToRecord = (cachedSalesPreview?.totalQtyToRecord ?? 0) > 0;
  const noSalesToRecord =
    !hasChanges && salesPreviewFetched && salesPreviewQueryEnabled && !hasSalesToRecord;

  const latestSavedAt = useMemo(() => {
    const times = (sheet?.rows ?? [])
      .map((r) => r.lastSavedAt)
      .filter((t): t is string => Boolean(t))
      .map((t) => new Date(t).getTime());
    return times.length > 0 ? new Date(Math.max(...times)).toISOString() : null;
  }, [sheet?.rows]);

  const recordablePreviewLines = useMemo(
    () =>
      (recordPreview?.lines ?? []).filter(
        (line) => line.qtyToRecord > 0 || line.status === "WARNING_OVER_RECORDED"
      ),
    [recordPreview]
  );

  const recordPreviewLinesWithQty = useMemo(
    () =>
      (recordPreview?.lines ?? []).filter((line) => line.qtyToRecord > 0).length,
    [recordPreview]
  );

  async function openRecordPreview() {
    setPreviewLoading(true);
    try {
      const result = cachedSalesPreview
        ? { data: cachedSalesPreview }
        : await refetchSalesPreview();
      const preview = result.data;
      if (preview) {
        setRecordPreview(preview);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRecordSalesClick() {
    if (!terminalId) {
      toast.error("Select a terminal in context before recording sales.");
      return;
    }
    if (!canEdit) {
      toast.error("Sales can only be recorded for today or yesterday.");
      return;
    }
    if (hasErrors) {
      toast.error("Fix validation errors before recording sales.");
      return;
    }
    if (hasChanges) {
      setSaveBeforeRecordOpen(true);
      return;
    }
    await openRecordPreview();
  }

  async function handleSaveBeforeRecordConfirm() {
    setSaveBeforeRecordOpen(false);
    if (hasChanges) {
      try {
        await saveMutation.mutateAsync();
      } catch {
        return;
      }
    }
    await openRecordPreview();
  }

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
        unitsSold: r.unitsSold,
        sellingPrice: r.sellingPrice,
        amount: r.amount,
        comments: r.comments,
      })),
      pdfTotals,
      branchName,
      orgName,
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

  function changeDate(newDate: string) {
    setLocalClosings({});
    setLocalComments({});
    setDateStr(newDate);
  }

  function goPrevDay() {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    changeDate(toDateStr(d));
  }

  function goNextDay() {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    changeDate(toDateStr(d));
  }

  function handleClosingChange(itemId: string, value: string) {
    // Allow empty, an in-progress decimal point, and up to 3 fractional digits.
    if (value === "" || /^\d*(\.\d{0,3})?$/.test(value)) {
      setLocalClosings((prev) => ({ ...prev, [itemId]: value }));
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
          subtitle={`Bar-style sheet at ${branchName ?? "this branch"}. Opening = latest saved Closing before this date (0 if never saved). Added = GRN receipts on this date. Total Stock = Opening + Added + Added today. Closing = physical count (defaults to Total Stock for unsaved rows so Units Sold starts at 0; editable); Units Sold = Total Stock − Closing.`}
          subtitleRevealOnTitleHover
          icon={FileSpreadsheet}
          fallbackTo="/operator"
        />
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {sheet ? (
          <div className="flex min-w-0 items-center gap-2">
            <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search all columns…" />
            {latestSavedAt && (
              <span className="hidden shrink-0 text-xs text-slate-500 md:inline dark:text-slate-400">
                Saved: {new Date(latestSavedAt).toLocaleString()}
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
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <DatePicker
            selected={dateStr ? parseDateStr(dateStr) : null}
            onChange={(d: Date | null) => changeDate(d ? toDateStr(d) : todayStr())}
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
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="mx-0.5 hidden h-4 w-px bg-slate-300 sm:mx-1 sm:block dark:bg-slate-600" aria-hidden />
          <Button
            variant="secondary"
            size="md"
            onClick={handleDownloadPdf}
            disabled={!sheet}
            aria-label="Download PDF"
            className="px-2.5 py-1.5 sm:px-4 sm:py-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden xs:inline">PDF</span>
          </Button>
          <Button
            size="md"
            onClick={handleSave}
            disabled={saveMutation.isPending || hasErrors || !canEdit || !hasChanges}
            className="px-2.5 py-1.5 sm:px-4 sm:py-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden xs:inline">Save</span>
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={() => void handleRecordSalesClick()}
            disabled={
              !sheet ||
              !canEdit ||
              !terminalId ||
              hasErrors ||
              previewLoading ||
              recordSalesMutation.isPending ||
              saveMutation.isPending ||
              noSalesToRecord ||
              (salesPreviewLoading && !hasChanges)
            }
            title={
              !terminalId
                ? "Select a terminal in context"
                : noSalesToRecord
                  ? "No sales to record for this date"
                  : hasChanges
                    ? "Save stock count first"
                    : salesPreviewLoading
                      ? "Checking sales to record…"
                      : "Record sales from Sold column"
            }
            aria-label="Record sales"
            className="px-2.5 py-1.5 sm:px-4 sm:py-2"
          >
            {previewLoading || recordSalesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingBag className="h-4 w-4" />
            )}
            <span className="hidden xs:inline">Record sales</span>
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setTableExpanded((v) => !v)}
            title={tableExpanded ? "Exit full screen" : "Expand table"}
            className="px-2.5 py-1.5 sm:px-4 sm:py-2"
            aria-label={tableExpanded ? "Exit full screen" : "Expand table"}
          >
            {tableExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!canEdit && !tableExpanded && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Viewing past date. Edits are disabled; only today and yesterday are
          editable (yesterday for testing).
        </p>
      )}

      {isError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      )}

      {!isError && (isInitialLoad || sheet) && (
        <div className="flex min-h-0 flex-1 flex-col">
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
              sizeOptions={[10, 15, 25, 50, 100]}
              onRefresh={() => void refetch()}
              isRefreshing={isRefreshing}
            />
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">
            ← swipe table to see all columns →
          </p>
          <div className={tableCard}>
            <div className="relative min-h-0 flex-1 overflow-auto">
              {/* Gradient fade on right edge */}
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "900px" }}>
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700">
                <tr>
                  <TableRowNumberHead />
                  <SortableTableHead
                    columnKey="item"
                    label="Item"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={`${tableStickyHeadCell} ${tableHeadCell}`}
                    title="Product name"
                  />
                  <SortableTableHead
                    columnKey="open"
                    label="Open"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                    title="Latest saved closing before this date (from your last stock count save)"
                  />
                  <SortableTableHead
                    columnKey="added"
                    label="Added"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                    title="GRN receipts since your last saved count through this date"
                  />
                  <SortableTableHead
                    columnKey="total"
                    label="Total"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                    title="Opening + Added + stock-take adds; equals System when counts align with the ledger"
                  />
                  <SortableTableHead
                    columnKey="close"
                    label="Close"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                    title="Physical count at end of day"
                  />
                  <SortableTableHead
                    columnKey="sold"
                    label="Sold"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                    title="Total Stock − Closing (units sold)"
                  />
                  <SortableTableHead
                    columnKey="price"
                    label="Price (KSH)"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                    title="Selling price per unit from price list"
                  />
                  <SortableTableHead
                    columnKey="amount"
                    label="Amt (KSH)"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className={tableHeadCell}
                    title="Units Sold × Selling Price (revenue value)"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {isInitialLoad ? (
                  <TableSkeleton columns={9} rows={12} />
                ) : paginatedRows.map((r, index) => (
                  <tr
                    key={r.itemId}
                    className={tableBodyRow}
                  >
                    <TableRowNumberCell page={page} pageSize={pageSize} indexInPage={index} />
                    <td className={tableStickyFirstBody}>
                      {r.name || "—"}
                    </td>
                    <td className={tableBodyCellNumDebts}>{r.openingStock}</td>
                    <td className={tableBodyCellNumDebts}>{r.addedStock}</td>
                    <td className={tableBodyCellNumDebts}>{r.totalStock}</td>
                    <td className={canEdit ? tableBodyCell : tableBodyCellNumDebts}>
                      {canEdit ? (
                        <div className="flex flex-col">
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]{0,3}"
                            value={
                              r.itemId in localClosings
                                ? localClosings[r.itemId]
                                : String(r.closingStock ?? "")
                            }
                            onChange={(e) =>
                              handleClosingChange(r.itemId, e.target.value)
                            }
                            className={`w-20 rounded border px-2 py-1 text-left text-lg tabular-nums sm:w-24 sm:text-xl ${
                              r.closingError
                                ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/20"
                                : r.closingStale
                                  ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/20"
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
                        r.closingStock
                      )}
                    </td>
                    <td className={tableBodyCellNumDebts}>{r.unitsSold}</td>
                    <td className={tableBodyCellNumDebts}>{formatAmount(r.sellingPrice)}</td>
                    <td className={`${tableBodyCellNumDebts} font-bold text-slate-700 dark:text-slate-300`}>
                      {formatAmount(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className={`mt-4 flex flex-wrap justify-end gap-1.5 sm:gap-3 ${tableExpanded ? "hidden" : ""}`}>
            <StatChip
              label="Today Debts"
              value={formatCurrency(dayDebtsTotal)}
              tone="debt"
              onClick={dayDebts.length > 0 ? () => setDebtModal("day") : undefined}
            />
            <StatChip
              label="Total Debts"
              value={formatCurrency(allDebtsTotal)}
              tone="debt"
              onClick={allDebts.length > 0 ? () => setDebtModal("all") : undefined}
            />
            <StatChip
              label="Expenses"
              value={formatCurrency(analytics?.expenseIntelligence?.todayTotal ?? 0)}
              tone="expense"
            />
            <StatChip
              label="Total Sales"
              value={formatCurrency(totals.amount)}
              tone="sales"
            />
          </div>

          {computedRows.length === 0 && (
            <p className="mt-4 text-center text-slate-500 dark:text-slate-400">
              No items in price list for this branch. Add items to a price list
              and assign it to the branch.
            </p>
          )}
        </div>
      )}

      <Modal
        open={debtModal !== null}
        onClose={() => setDebtModal(null)}
        title={
          debtModal === "day"
            ? `Debtors — ${dateStr}`
            : debtModal === "all"
              ? "All Outstanding Debtors"
              : undefined
        }
        className="p-0"
      >
        <div className="-m-5 flex flex-col">
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
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
                    <span className="shrink-0 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
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
      </Modal>

      <ConfirmDialog
        open={saveBeforeRecordOpen}
        onClose={() => setSaveBeforeRecordOpen(false)}
        onConfirm={() => void handleSaveBeforeRecordConfirm()}
        title="Save stock count first?"
        message="Closing counts must be saved before sales can be recorded from the Sold column."
        confirmLabel="Save and continue"
        variant="primary"
        loading={saveMutation.isPending || previewLoading}
      />

      <SlideOver
        open={recordPreview !== null}
        onClose={() => setRecordPreview(null)}
        title="Record sales from stock count"
        maxWidth="max-w-xl"
      >
        {recordPreview && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Evaluates all{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {recordPreview.lines.length} products
              </span>{" "}
              on this sheet (every page), not just the rows visible now. Quantities below
              reconcile with POS and sales already recorded for {dateStr}.
            </p>
            {searchQuery.trim().length > 0 && (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                Table filter is active — Record sales still uses the full sheet.
              </p>
            )}
            {recordPreview.totalQtyToRecord <= 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                No new quantities to record. Implied sold already matches completed sales for
                this date, or closings are not saved yet.
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The following quantities will be posted as completed cash sales and will reduce
                inventory on hand.
              </p>
            )}
            {recordablePreviewLines.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                        Implied
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                        Recorded
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                        To record
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                        Amt (KSH)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {recordablePreviewLines.map((line) => (
                      <tr key={line.itemId}>
                        <td className="px-3 py-2 text-sm text-slate-900 dark:text-white">
                          {line.name}
                          {line.status === "WARNING_OVER_RECORDED" && (
                            <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">
                              Already recorded exceeds implied sold
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                          {line.impliedSold}
                        </td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                          {line.alreadyRecorded}
                        </td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {line.qtyToRecord}
                        </td>
                        <td className="px-3 py-2 text-left text-sm tabular-nums text-slate-700 dark:text-slate-300">
                          {formatAmount(line.lineValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-600">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {recordPreviewLinesWithQty} product(s) to record
                </span>
                {" · "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {recordPreview.totalQtyToRecord} units
                </span>
                {" · "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(recordPreview.totalValueToRecord)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecordPreview(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => recordSalesMutation.mutate()}
                  disabled={
                    recordPreview.totalQtyToRecord <= 0 || recordSalesMutation.isPending
                  }
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {recordSalesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  Record sales
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
