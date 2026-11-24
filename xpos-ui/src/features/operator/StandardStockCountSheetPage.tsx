import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { PageHeader } from "@/components/PageHeader";
import { InlineCopilot } from "@/components/InlineCopilot";
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
  autoSyncStdStockCount,
  fetchStdStockCountSalesPreview,
  recordStdStockCountSales,
  fetchStdStockCountReconcilePreview,
  reconcileStdStockCountInventory,
  type StdStockCountRowResponse,
  type StdStockCountSalesPreviewResponse,
  type StdStockCountSheetResponse,
} from "@/api/stdStockCount";
import { fetchOperatorAnalyticsSnapshot } from "@/api/operatorAnalytics";
import { fetchDebts } from "@/api/debts";
import { formatCurrency, formatAmount } from "@/utils/formatCurrency";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import { formatQty, formatQtyInput, formatQtyVariance, isValidQtyInput, roundQty } from "@/utils/formatQuantity";
import {
  getApiErrorMessage,
  getApiErrorRequestId,
  isApiFetchError,
} from "@/utils/apiError";
import { invalidateInventoryQueries } from "@/utils/invalidateInventoryQueries";
import { useToast } from "@/contexts/ToastContext";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { APP_NAME_KEY } from "@/config/headerNavItems";
import {
  STD_STOCK_COUNT_SHOW_PDF,
  STD_STOCK_COUNT_SHOW_SAVE,
  STD_STOCK_COUNT_SHOW_RECONCILE,
  STD_STOCK_COUNT_SHOW_RECORD_SALES,
  isStdStockCountButtonVisible,
} from "@/config/stdStockCountVisibility";
import {
  getSavedStockCountDate,
  saveStockCountDate,
} from "@/utils/datePersistenceStorage";
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
  GitCompare,
  RotateCw,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadStdStockCountPdf } from "@/utils/stdStockCountPdf";
import {
  Button,
  IconButton,
  Modal,
  ModalFooter,
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  StatChip,
  TableSearchInput,
  TableSkeleton,
  ConfirmDialog,
  tableHeadCell,
  tableBodyCellNumDebts,
  tableBodyRow,
  tableBodyRowZebra,
  tableStickyFirstBody,
  tableStickyHeadCell,
  tableCard,
} from "@/components/ui";
import { SlideOver } from "@/components/ui/SlideOver";
import { useDataTable } from "@/hooks/useDataTable";
import { usePersistedSearch } from "@/hooks/usePersistedSearch";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useTableCustomization } from "@/contexts/TableCustomizationContext";
import {
  getStoredTablePageSize,
  setStoredTablePageSize,
  hasStoredTablePageSize,
} from "@/utils/tablePaginationStorage";

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

const MAX_BACKDATE_DAYS = 14;

function isWithinBackdateWindow(dateStr: string): boolean {
  try {
    const target = parseDateStr(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= MAX_BACKDATE_DAYS;
  } catch {
    return false;
  }
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
  /** Local closing differs from last saved snapshot for this row. */
  closingUnsaved?: boolean;
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

/** Saved closing is stale when stock arrived after last save, closing equals opening (no operator count/sales performed), and closing is less than total. When sales exist, it is also stale if closing + alreadyRecorded matches opening stock but total exceeds opening stock (pre-receipt baseline). */
export function isStaleSavedClosing(
  row: StdStockCountRowResponse,
  alreadyRecorded: number = 0
): boolean {
  if (row.closingStock == null) return false;
  const total = totalStockFromRow(row);
  if (row.closingStock >= total) return false;

  const stockAddedAt = row.latestStockAddedAt ?? row.firstStockAddedAt;

  if (alreadyRecorded <= 0) {
    if (!row.lastSavedAt || !stockAddedAt) return false;
    return (
      row.closingStock === row.openingStock &&
      row.lastSavedAt < stockAddedAt
    );
  }

  const impliedPreSaleStock = roundQty(row.closingStock + alreadyRecorded);
  return impliedPreSaleStock === row.openingStock && total > row.openingStock;
}

export interface AutoSyncClosingContext {
  addedIncreased: boolean;
  priorAdded?: number;
  alreadyRecorded?: number;
}

/** Whether closing should be bumped to total (or max physical after sales) and auto-saved (GRN / cross-tab Added increase / stale closing). */
export function shouldAutoSyncClosing(
  row: StdStockCountRowResponse,
  ctx: AutoSyncClosingContext
): boolean {
  if (isStaleSavedClosing(row, ctx.alreadyRecorded ?? 0)) {
    return true;
  }
  if (ctx.alreadyRecorded !== undefined && ctx.alreadyRecorded > 0) {
    // If sales were already recorded and closing is not stale, NEVER auto-sync closing to total stock.
    return false;
  }
  // Carry-forward / unsaved row with positive total stock — persist closing = total.
  if (row.closingStock == null && totalStockFromRow(row) > 0) {
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
  if (ctx.priorAdded !== undefined) {
    const priorTotal =
      row.openingStock + ctx.priorAdded + (row.addedTodayStock ?? 0);
    if (saved === priorTotal) {
      return true;
    }
  }
  return false;
}

export function totalStockFromRow(row: StdStockCountRowResponse): number {
  return roundQty(
    (row.openingStock ?? 0) +
    (row.addedStock ?? 0) +
    (row.addedTodayStock ?? 0)
  );
}

/** Saved closing if present; otherwise Total stock (Open + Added + AddedToday) so unsaved rows start at "nothing sold yet" and never exceed Total. If sales were already recorded, closing cannot exceed total - alreadyRecorded. Stale saved closings default to Total stock (or max physical stock if sales recorded). */
export function defaultClosingFromRow(
  row: StdStockCountRowResponse,
  alreadyRecorded: number = 0
): number {
  const total = totalStockFromRow(row);
  if (isStaleSavedClosing(row, alreadyRecorded)) {
    if (alreadyRecorded > 0) {
      return Math.max(0, roundQty(total - alreadyRecorded));
    }
    return total;
  }
  if (row.closingStock !== null && row.closingStock !== undefined) {
    if (alreadyRecorded > 0) {
      const maxPhysical = Math.max(0, roundQty(total - alreadyRecorded));
      return roundQty(Math.min(row.closingStock, maxPhysical));
    }
    return roundQty(row.closingStock);
  }
  if (alreadyRecorded > 0) {
    return Math.max(0, roundQty(total - alreadyRecorded));
  }
  return total;
}

export function computeRow(
  row: StdStockCountRowResponse,
  localClosing: number | undefined,
  localComment: string | undefined,
  alreadyRecorded: number = 0
): ComputedRow {
  const closing = roundQty(localClosing ?? defaultClosingFromRow(row, alreadyRecorded));
  const total = roundQty(
    row.openingStock + row.addedStock + (row.addedTodayStock ?? 0)
  );
  const unitsSold = Math.max(0, roundQty(total - closing));
  const amount = roundQty(unitsSold * (row.sellingPrice ?? 0));
  const comments =
    localComment !== undefined ? localComment : (row.comments ?? "");

  let closingError: string | undefined;
  if (closing < 0) {
    closingError = "Must be ≥ 0";
  } else if (closing > total) {
    closingError = "Cannot exceed total stock";
  }

  const closingStale =
    isStaleSavedClosing(row, alreadyRecorded) &&
    (localClosing === undefined || closing !== row.closingStock);

  const closingUnsaved =
    localClosing !== undefined &&
    (row.closingStock == null || closing !== row.closingStock);

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
    closingUnsaved,
  };
}

function getDraftStorageKey(orgId: string, branchId: string, dateStr: string): string {
  return `xpos_stock_count_draft_${orgId}_${branchId}_${dateStr}`;
}

function loadDraft(orgId: string, branchId: string, dateStr: string) {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(orgId, branchId, dateStr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        closings:
          parsed.closings && typeof parsed.closings === "object"
            ? (parsed.closings as Record<string, string>)
            : {},
        comments:
          parsed.comments && typeof parsed.comments === "object"
            ? (parsed.comments as Record<string, string>)
            : {},
      };
    }
  } catch {}
  return null;
}

function saveDraft(
  orgId: string,
  branchId: string,
  dateStr: string,
  closings: Record<string, string>,
  comments: Record<string, string>
) {
  try {
    if (Object.keys(closings).length === 0 && Object.keys(comments).length === 0) {
      localStorage.removeItem(getDraftStorageKey(orgId, branchId, dateStr));
    } else {
      localStorage.setItem(
        getDraftStorageKey(orgId, branchId, dateStr),
        JSON.stringify({ closings, comments, updatedAt: Date.now() })
      );
    }
  } catch {}
}

export interface StandardStockCountSheetPageProps {
  /** Override org context (for admin) */
  orgId?: string;
  /** Override branch context (for admin) */
  branchId?: string;
  branchName?: string;
  orgName?: string;
  /** Override terminal context (for admin) */
  terminalId?: string | null;
  /** Fallback URL for back navigation */
  fallbackTo?: string;
}

export function StandardStockCountSheetPage({
  orgId: orgIdProp,
  branchId: branchIdProp,
  branchName: branchNameProp,
  orgName: orgNameProp,
  terminalId: terminalIdProp,
  fallbackTo: fallbackToProp,
}: StandardStockCountSheetPageProps = {}) {
  const location = useLocation();
  const token = useAppSelector(selectToken);
  const contextOrgId = useAppSelector(selectOrgId) ?? "";
  const contextBranchId = useAppSelector(selectBranchId) ?? "";
  const contextBranchName = useAppSelector(selectBranchName);
  const contextOrgName = useAppSelector(selectOrgName);
  const contextTerminalId = useAppSelector(selectTerminalId);

  const orgId = orgIdProp ?? contextOrgId;
  const branchId = branchIdProp ?? contextBranchId;
  const branchName = branchNameProp ?? contextBranchName;
  const orgName = orgNameProp ?? contextOrgName;
  const terminalId = terminalIdProp ?? contextTerminalId;
  const fallbackTo = fallbackToProp ?? (location.pathname.startsWith("/admin") ? "/admin" : "/operator");
  const queryClient = useQueryClient();
  const toast = useToast();
  const navVisibility = useNavVisibilityContextOrNull();
  const appName = navVisibility
    ? navVisibility.getHeaderLabel(APP_NAME_KEY, "XPOS")
    : "XPOS";
  const operatorVisibility = navVisibility?.operatorVisibility ?? {};
  const showPdfButton = isStdStockCountButtonVisible(
    operatorVisibility,
    STD_STOCK_COUNT_SHOW_PDF
  );
  const showSaveButton = isStdStockCountButtonVisible(
    operatorVisibility,
    STD_STOCK_COUNT_SHOW_SAVE
  );
  const showReconcileSetting = isStdStockCountButtonVisible(
    operatorVisibility,
    STD_STOCK_COUNT_SHOW_RECONCILE
  );
  const showRecordSalesButton = isStdStockCountButtonVisible(
    operatorVisibility,
    STD_STOCK_COUNT_SHOW_RECORD_SALES
  );
  const [dateStr, setDateStr] = useState<string>(
    () => getSavedStockCountDate(orgId, branchId) || todayStr()
  );

  // Sync date when orgId or branchId becomes available or changes
  useEffect(() => {
    if (!orgId || !branchId) return;
    const saved = getSavedStockCountDate(orgId, branchId);
    if (saved && saved !== dateStr) {
      userHasEditedRef.current = false;
      setLocalClosings({});
      setLocalComments({});
      setDateStr(saved);
    }
  }, [orgId, branchId]);
  const [localClosings, setLocalClosings] = useState<Record<string, string>>({});
  const [localComments, setLocalComments] = useState<Record<string, string>>({});
  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(new Set());
  const lastKeystrokeAtRef = useRef<number>(0);
  const tableCustom = useTableCustomization("std-stock-count");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() =>
    getStoredTablePageSize("std-stock-count", tableCustom.pageSize || 15, [10, 15, 25, 50, 100, 200])
  );

  useEffect(() => {
    if (!hasStoredTablePageSize("std-stock-count") && tableCustom.pageSize && tableCustom.pageSize > 0) {
      setPageSize(tableCustom.pageSize);
    }
  }, [tableCustom.pageSize]);
  const [debtModal, setDebtModal] = useState<"day" | "all" | null>(null);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [recordPreview, setRecordPreview] = useState<StdStockCountSalesPreviewResponse | null>(
    null
  );
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [saveBeforeRecordOpen, setSaveBeforeRecordOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const priorAddedStockSignatureRef = useRef("");
  const skipAutoSaveDebounceRef = useRef(false);
  const systemSyncPendingRef = useRef(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [isPendingSystemSync, setIsPendingSystemSync] = useState(false);
  const userHasEditedRef = useRef(false);
  const suppressAutoSyncUntilRefetchRef = useRef(false);

  const inFlightSnapshotRef = useRef<{
    closings: Record<string, string>;
    comments: Record<string, string>;
    itemIds: Set<string>;
  } | null>(null);
  const pendingSaveScheduledRef = useRef(false);
  const pendingBlurSaveRef = useRef(false);
  const doSaveNowRef = useRef<() => void>(() => {});
  const doAutoSaveRef = useRef<() => void>(() => {});
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);

  const isToday = dateStr === todayStr();
  const canEdit = isWithinBackdateWindow(dateStr);

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
    token && orgId && branchId && canEdit && sheet
  );

  const {
    data: cachedSalesPreview,
    isLoading: salesPreviewLoading,
    refetch: refetchSalesPreview,
  } = useQuery({
    queryKey: ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
    queryFn: () => fetchStdStockCountSalesPreview(token, orgId, branchId, dateStr),
    enabled: salesPreviewQueryEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const alreadyRecordedByItem = useMemo(() => {
    const map: Record<string, number> = {};
    (cachedSalesPreview?.lines ?? []).forEach((line) => {
      map[line.itemId] = line.alreadyRecorded ?? 0;
    });
    return map;
  }, [cachedSalesPreview?.lines]);

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

  function parseClosing(
    itemId: string,
    row: StdStockCountRowResponse,
    alreadyRecorded: number = 0
  ): number {
    const s = localClosings[itemId];
    if (s === undefined) return roundQty(defaultClosingFromRow(row, alreadyRecorded));
    if (s === "" || s === ".") return 0;
    const n = parseFloat(s);
    if (Number.isNaN(n)) return 0;
    return roundQty(n);
  }

  function parseCommentForSave(itemId: string, row: StdStockCountRowResponse): string {
    const s = localComments[itemId];
    if (s !== undefined) return s;
    return row.comments ?? "";
  }

  function isRowChanged(r: StdStockCountRowResponse): boolean {
    const already = alreadyRecordedByItem[r.itemId] ?? 0;
    if (localClosings[r.itemId] !== undefined) {
      const parsed = parseClosing(r.itemId, r, already);
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
    if (already > 0) {
      // Item already has recorded sales. Do NOT treat unsaved carry-forward or stale receipts as auto-changes.
      return false;
    }
    if (r.closingStock == null && totalStockFromRow(r) > 0) {
      return true;
    }
    if (isStaleSavedClosing(r, already)) {
      return true;
    }
    return false;
  }

  // Save only rows the operator changed — avoids blank zero saves blocking carry-forward.
  const saveChangedRows = useCallback(async () => {
    const rows = sheet?.rows ?? [];
    const changedRows = rows.filter((r) => isRowChanged(r));
    if (changedRows.length === 0) {
      return null;
    }

    const itemIds = new Set(changedRows.map((r) => r.itemId));
    setSavingItemIds(itemIds);
    const closingsSnapshot: Record<string, string> = {};
    const commentsSnapshot: Record<string, string> = {};
    for (const r of changedRows) {
      if (localClosings[r.itemId] !== undefined) {
        closingsSnapshot[r.itemId] = localClosings[r.itemId];
      }
      if (localComments[r.itemId] !== undefined) {
        commentsSnapshot[r.itemId] = localComments[r.itemId];
      }
    }
    inFlightSnapshotRef.current = {
      closings: closingsSnapshot,
      comments: commentsSnapshot,
      itemIds,
    };

    const response = await saveStdStockCount(token, orgId, branchId, {
      date: dateStr,
      outletId: branchId,
      counts: changedRows.map((r) => ({
        itemId: r.itemId,
        closingStock: parseClosing(r.itemId, r, alreadyRecordedByItem[r.itemId] ?? 0),
        comments: parseCommentForSave(r.itemId, r),
      })),
    });
    return response;
  }, [sheet?.rows, token, orgId, branchId, dateStr, localClosings, localComments, alreadyRecordedByItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetchPreviewsRef = useRef<() => void>(() => {});

  const invalidateAfterSheetSave = useCallback(
    (updatedSheet?: StdStockCountSheetResponse | null) => {
      if (updatedSheet) {
        queryClient.setQueryData(
          ["std-stock-count", token, orgId, branchId, dateStr],
          updatedSheet
        );
      } else {
        void invalidateInventoryQueries(queryClient);
      }

      void queryClient.invalidateQueries({
        queryKey: ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["std-stock-count-reconcile-preview", token, orgId, branchId, dateStr],
        refetchType: "all",
      });
      refetchPreviewsRef.current();

      const inFlight = inFlightSnapshotRef.current;
      if (inFlight) {
        setLocalClosings((prev) => {
          let hasRemaining = false;
          const next: Record<string, string> = {};
          for (const [id, val] of Object.entries(prev)) {
            // Keep if not in this save, or if edited again while in-flight
            if (inFlight.itemIds.has(id) && inFlight.closings[id] === val) {
              continue;
            }
            next[id] = val;
            hasRemaining = true;
          }
          return hasRemaining ? next : {};
        });
        setLocalComments((prev) => {
          let hasRemaining = false;
          const next: Record<string, string> = {};
          for (const [id, val] of Object.entries(prev)) {
            if (inFlight.itemIds.has(id) && inFlight.comments[id] === val) {
              continue;
            }
            next[id] = val;
            hasRemaining = true;
          }
          return hasRemaining ? next : {};
        });
        inFlightSnapshotRef.current = null;
      } else {
        setLocalClosings({});
        setLocalComments({});
      }
    },
    [queryClient, token, orgId, branchId, dateStr]
  );

  const handleSaveMutationError = useCallback(
    (err: unknown, silent: boolean) => {
      const isDuplicateSnapshot =
        isApiFetchError(err) &&
        err.status === 409 &&
        getApiErrorMessage(err).includes("uq_std_stock_count");
      if (isDuplicateSnapshot) {
        setLocalClosings({});
        setLocalComments({});
        void refetch();
        return;
      }
      if (!silent) {
        toast.error(getApiErrorMessage(err), {
          detail: getApiErrorRequestId(err)
            ? `Reference: ${getApiErrorRequestId(err)}`
            : undefined,
        });
      }
    },
    [refetch, toast]
  );

  const saveMutation = useMutation({
    mutationFn: saveChangedRows,
    onSuccess: (result) => {
      invalidateAfterSheetSave(result);
      toast.success("Stock count saved.", { title: "Saved" });
    },
    onError: (err) => {
      setSavingItemIds(new Set());
      inFlightSnapshotRef.current = null;
      handleSaveMutationError(err, false);
    },
    onSettled: () => {
      setSavingItemIds(new Set());
      if (pendingSaveScheduledRef.current) {
        pendingSaveScheduledRef.current = false;
        const isBlur = pendingBlurSaveRef.current;
        pendingBlurSaveRef.current = false;
        if (isBlur) {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            doSaveNowRef.current();
          }, 100);
        } else {
          const elapsed = Date.now() - lastKeystrokeAtRef.current;
          const remaining = Math.max(0, AUTO_SAVE_DEBOUNCE_MS - elapsed);
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            doAutoSaveRef.current();
          }, remaining);
        }
      }
    },
  });

  /** Background carry-forward / stale-receipt sync — must not drive Save button loading state. */
  const systemSyncMutation = useMutation({
    mutationFn: saveChangedRows,
    onSuccess: (result) => {
      invalidateAfterSheetSave(result);
    },
    onError: (err) => {
      setSavingItemIds(new Set());
      inFlightSnapshotRef.current = null;
      handleSaveMutationError(err, true);
    },
    onSettled: () => {
      setSavingItemIds(new Set());
      if (pendingSaveScheduledRef.current) {
        pendingSaveScheduledRef.current = false;
        const isBlur = pendingBlurSaveRef.current;
        pendingBlurSaveRef.current = false;
        if (isBlur) {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            doSaveNowRef.current();
          }, 100);
        } else {
          const elapsed = Date.now() - lastKeystrokeAtRef.current;
          const remaining = Math.max(0, AUTO_SAVE_DEBOUNCE_MS - elapsed);
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            doAutoSaveRef.current();
          }, remaining);
        }
      }
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async () =>
      reconcileStdStockCountInventory(token, orgId, branchId, {
        date: dateStr,
        outletId: branchId,
      }),
    onSuccess: (result) => {
      suppressAutoSyncUntilRefetchRef.current = true;
      void invalidateInventoryQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ["std-stock-count-reconcile-preview", token, orgId, branchId, dateStr],
      });
      setReconcileModalOpen(false);
      if (result.adjustedCount === 0) {
        toast.success("Inventory already matches saved closings.", {
          title: "Reconcile inventory",
        });
      } else {
        toast.success(
          `Adjusted on-hand for ${result.adjustedCount} item(s) to match saved closings.`,
          { title: "Inventory reconciled" }
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
      queryClient.setQueryData(
        ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
        (old: any) =>
          old
            ? {
                ...old,
                totalQtyToRecord: 0,
                totalValueToRecord: 0,
                lines: (old.lines ?? []).map((l: any) => ({
                  ...l,
                  qtyToRecord: 0,
                  lineValue: 0,
                  alreadyRecorded: l.impliedSold,
                  status: "RECORDED",
                })),
              }
            : old
      );
      void queryClient.invalidateQueries({
        queryKey: ["std-stock-count-sales-preview", token, orgId, branchId, dateStr],
      });
      void refetchSalesPreview();
      void refetch();
      void refetchReconcilePreview();
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
    return rows.map((r) => {
      const already = alreadyRecordedByItem[r.itemId] ?? 0;
      return computeRow(
        r,
        localClosings[r.itemId] !== undefined ? parseClosing(r.itemId, r, already) : undefined,
        localComments[r.itemId] !== undefined ? localComments[r.itemId] : undefined,
        already
      );
    });
  }, [sheet?.rows, localClosings, localComments, alreadyRecordedByItem]);

  const [searchQuery, setSearchQuery] = usePersistedSearch();

  const tableInputRows = useMemo(() => {
    if (!searchQuery.trim()) return allComputedRows;
    return allComputedRows.filter((r) => r.closingStock > 0 || r.unitsSold > 0);
  }, [allComputedRows, searchQuery]);

  const {
    filteredRows: paginatedRows,
    allFilteredRows: computedRows,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(tableInputRows, undefined, {
    searchQuery,
    setSearchQuery,
    getSearchableText: (row) => row.name,
    page,
    size: pageSize,
    setPage,
    sortAccessors: STANDARD_STOCK_SORT,
    getDefaultDirection: (col) =>
      col === "sold" || col === "amount" ? "desc" : "asc",
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
    if (!rows || !canEdit || saveMutation.isPending || systemSyncMutation.isPending) return;

    if (suppressAutoSyncUntilRefetchRef.current) {
      priorAddedStockSignatureRef.current = addedStockSignature;
      suppressAutoSyncUntilRefetchRef.current = false;
      return;
    }

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
        const priorAdded = priorAddedByItem.get(row.itemId);
        const addedIncreased =
          priorAdded !== undefined && row.addedStock > priorAdded;
        const alreadyRecorded = alreadyRecordedByItem[row.itemId] ?? 0;
        const total = totalStockFromRow(row);
        const maxPhysical = Math.max(0, total - alreadyRecorded);

        const existingLocal = prev[row.itemId];
        if (existingLocal !== undefined) {
          const num = Number(existingLocal);
          if (!Number.isNaN(num) && num > maxPhysical) {
            if (next === null) next = { ...prev };
            next[row.itemId] = String(maxPhysical);
          }
          continue;
        }

        if (shouldAutoSyncClosing(row, { addedIncreased, priorAdded, alreadyRecorded })) {
          if (next === null) next = { ...prev };
          const targetClosing =
            row.closingStock != null && row.closingStock > maxPhysical
              ? maxPhysical
              : alreadyRecorded > 0
              ? maxPhysical
              : total;
          next[row.itemId] = String(targetClosing);
        }
      }
      if (next !== null) {
        systemSyncPendingRef.current = true;
        setIsPendingSystemSync(true);
      }
      return next ?? prev;
    });

    priorAddedStockSignatureRef.current = addedStockSignature;
  }, [sheet, addedStockSignature, canEdit, dateStr, saveMutation.isPending, systemSyncMutation.isPending, alreadyRecordedByItem]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(computedRows.length / pageSize) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [computedRows.length, pageSize]);

  useEffect(() => {
    if (pendingFocusIndexRef.current !== null) {
      const idx = pendingFocusIndexRef.current;
      pendingFocusIndexRef.current = null;
      requestAnimationFrame(() => {
        inputRefs.current[idx]?.focus();
      });
    }
  }, [page]);

  const totals = useMemo(() => {
    return computedRows.reduce(
      (acc, r) => ({
        unitsSold: acc.unitsSold + r.unitsSold,
        amount: acc.amount + r.amount,
      }),
      { unitsSold: 0, amount: 0 }
    );
  }, [computedRows]);

  const allRowsForPdf = searchQuery.trim() ? computedRows : allComputedRows;

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
  }, [sheet?.rows, localClosings, localComments, alreadyRecordedByItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasErrors = computedRows.some(
    (r) => changedItemIds.has(r.itemId) && r.closingError
  );

  const hasChanges = changedItemIds.size > 0;

  // Restore offline draft from localStorage if present
  useEffect(() => {
    if (!orgId || !branchId || !dateStr) return;
    const draft = loadDraft(orgId, branchId, dateStr);
    if (draft) {
      if (Object.keys(draft.closings).length > 0) {
        setLocalClosings((prev) =>
          Object.keys(prev).length === 0 ? draft.closings : prev
        );
      }
      if (Object.keys(draft.comments).length > 0) {
        setLocalComments((prev) =>
          Object.keys(prev).length === 0 ? draft.comments : prev
        );
      }
    }
  }, [orgId, branchId, dateStr]);

  // Persist local edits to localStorage draft
  useEffect(() => {
    if (!orgId || !branchId || !dateStr) return;
    saveDraft(orgId, branchId, dateStr, localClosings, localComments);
  }, [orgId, branchId, dateStr, localClosings, localComments]);

  // Warn user if navigating away while saves are in-flight or unsaved edits exist
  useEffect(() => {
    const isSaving = saveMutation.isPending || systemSyncMutation.isPending;
    if (!hasChanges && !isSaving) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges, saveMutation.isPending, systemSyncMutation.isPending]);

  useEffect(() => {
    if (!systemSyncPendingRef.current || !hasChanges || hasErrors || !canEdit) {
      return;
    }
    systemSyncPendingRef.current = false;
    skipAutoSaveDebounceRef.current = true;

    const rows = sheet?.rows ?? [];
    const changedRows = rows.filter((r) => isRowChanged(r));
    const onlyCarryForward =
      changedRows.length > 0 &&
      changedRows.every(
        (r) =>
          r.closingStock == null &&
          localComments[r.itemId] === undefined &&
          (localClosings[r.itemId] === undefined ||
            localClosings[r.itemId] === String(totalStockFromRow(r)))
      );

    if (onlyCarryForward && token && orgId && branchId) {
      setIsAutoSyncing(true);
      void autoSyncStdStockCount(token, orgId, branchId)
        .then(() => refetch())
        .then(() => {
          setLocalClosings({});
          setLocalComments({});
        })
        .catch(() => {
          if (!systemSyncMutation.isPending) {
            systemSyncMutation.mutate();
          }
        })
        .finally(() => {
          setIsAutoSyncing(false);
          setIsPendingSystemSync(false);
        });
      return;
    }

    if (!systemSyncMutation.isPending) {
      systemSyncMutation.mutate();
    }
    setIsPendingSystemSync(false);
  }, [
    localClosings,
    localComments,
    hasChanges,
    hasErrors,
    canEdit,
    sheet,
    token,
    orgId,
    branchId,
    refetch,
    systemSyncMutation,
  ]);

  const remainingQtyToRecord = cachedSalesPreview?.totalQtyToRecord ?? 0;

  const reactiveTotalQtyToRecord = useMemo(() => {
    let sum = 0;
    for (const r of allComputedRows) {
      const already = alreadyRecordedByItem[r.itemId] ?? 0;
      const toRecord = Math.max(0, (r.unitsSold ?? 0) - already);
      sum += toRecord;
    }
    return sum;
  }, [allComputedRows, alreadyRecordedByItem]);

  const effectiveTotalQtyToRecord = hasChanges
    ? (reactiveTotalQtyToRecord > 0 ? reactiveTotalQtyToRecord : remainingQtyToRecord)
    : remainingQtyToRecord;

  const reactiveUniqueItemsToRecord = useMemo(() => {
    let count = 0;
    for (const r of allComputedRows) {
      const already = alreadyRecordedByItem[r.itemId] ?? 0;
      const toRecord = Math.max(0, (r.unitsSold ?? 0) - already);
      if (toRecord > 0) {
        count++;
      }
    }
    return count;
  }, [allComputedRows, alreadyRecordedByItem]);

  const cachedUniqueItemsToRecord = useMemo(() => {
    return (cachedSalesPreview?.lines ?? []).filter((l) => (l.qtyToRecord ?? 0) > 0).length;
  }, [cachedSalesPreview?.lines]);

  const effectiveUniqueItemsToRecord = hasChanges
    ? (reactiveUniqueItemsToRecord > 0 ? reactiveUniqueItemsToRecord : cachedUniqueItemsToRecord)
    : cachedUniqueItemsToRecord;

  const showRecordSales =
    showRecordSalesButton &&
    canEdit &&
    effectiveTotalQtyToRecord > 0;

  const saveButtonActive =
    canEdit && hasChanges && !hasErrors && !saveMutation.isPending;
  const recordSalesButtonActive =
    Boolean(sheet) &&
    canEdit &&
    Boolean(terminalId) &&
    !hasErrors &&
    !previewLoading &&
    !recordSalesMutation.isPending &&
    !saveMutation.isPending;

  const reconcilePreviewQueryEnabled = Boolean(
    token && orgId && branchId && isToday && sheet && !hasErrors
  );

  const {
    data: cachedReconcilePreview,
    refetch: refetchReconcilePreview,
  } = useQuery({
    queryKey: ["std-stock-count-reconcile-preview", token, orgId, branchId, dateStr],
    queryFn: () => fetchStdStockCountReconcilePreview(token, orgId, branchId, dateStr),
    enabled: reconcilePreviewQueryEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    refetchPreviewsRef.current = () => {
      void refetchSalesPreview();
      void refetchReconcilePreview();
    };
  }, [refetchSalesPreview, refetchReconcilePreview]);

  const hasStaleClosings = useMemo(() => {
    return (sheet?.rows ?? []).some((r) =>
      isStaleSavedClosing(r, alreadyRecordedByItem[r.itemId] ?? 0)
    );
  }, [sheet?.rows, alreadyRecordedByItem]);

  const isSyncingStock =
    systemSyncMutation.isPending ||
    hasStaleClosings ||
    isAutoSyncing ||
    isPendingSystemSync;

  const isSyncingOrAdjusting =
    !userHasEditedRef.current &&
    (isInitialLoad ||
      hasStaleClosings ||
      systemSyncMutation.isPending ||
      isAutoSyncing ||
      isPendingSystemSync ||
      reconcileMutation.isPending ||
      (sheetQuery.isFetching && (sheetQuery.isStale || hasStaleClosings)));

  const handleRefreshAll = useCallback(() => {
    void refetch();
    void refetchSalesPreview();
    void refetchReconcilePreview();
  }, [refetch, refetchSalesPreview, refetchReconcilePreview]);

  const itemsToReconcile = cachedReconcilePreview?.itemsAdjusted ?? 0;
  const showReconcileButton =
    isToday &&
    !hasChanges &&
    !hasErrors &&
    !isSyncingStock &&
    !isSyncingOrAdjusting &&
    itemsToReconcile > 0;

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

  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);

  async function openRecordPreview() {
    setPreviewLoading(true);
    try {
      const result = await refetchSalesPreview();
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

  async function handleRefreshPreview() {
    setIsRefreshingPreview(true);
    try {
      const result = await refetchSalesPreview();
      const preview = result.data;
      if (preview) {
        setRecordPreview(preview);
        toast.success("Sales preview refreshed");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setIsRefreshingPreview(false);
    }
  }

  function handleReconcileClick() {
    setReconcileModalOpen(true);
  }

  function handleReconcileProceed() {
    reconcileMutation.mutate();
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
    if (allRowsForPdf.length === 0) {
      toast.error("No items matching the search query to export.");
      return;
    }
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
          issuedBy: d.issuedBy,
          outstanding: d.outstanding,
          dueDate: d.dueDate,
          createdAt: d.createdAt,
        })),
        dayDebtsTotal,
        allDebts: allDebts.map((d) => ({
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          issuedBy: d.issuedBy,
          outstanding: d.outstanding,
          dueDate: d.dueDate,
          createdAt: d.createdAt,
        })),
        allDebtsTotal,
        expensesTotal: analytics?.expenseIntelligence?.todayTotal ?? 0,
      },
      { searchQuery: searchQuery.trim() || undefined }
    );
    toast.success("PDF downloaded.", { title: "Stock taking" });
  }

  function changeDate(newDate: string) {
    userHasEditedRef.current = false;
    setLocalClosings({});
    setLocalComments({});
    setDateStr(newDate);
    saveStockCountDate(newDate, orgId, branchId);
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
    if (!canEdit) return;
    // Allow empty, an in-progress decimal point, and up to 3 fractional digits.
    if (isValidQtyInput(value)) {
      userHasEditedRef.current = true;
      lastKeystrokeAtRef.current = Date.now();
      setLocalClosings((prev) => ({ ...prev, [itemId]: value }));
    }
  }

  // Auto-save: 2.5s debounce while typing to let operator finish; fast 150ms save on blur
  const AUTO_SAVE_DEBOUNCE_MS = 2500;
  const BLUR_SAVE_DEBOUNCE_MS = 150;
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSaveNow = useCallback(() => {
    if (hasErrors || !canEdit || !hasChanges) return;
    if (saveMutation.isPending || systemSyncMutation.isPending) {
      pendingBlurSaveRef.current = true;
      pendingSaveScheduledRef.current = true;
      return;
    }
    saveMutation.mutate();
  }, [hasErrors, canEdit, hasChanges, saveMutation, systemSyncMutation]);

  const doAutoSave = useCallback(() => {
    if (hasErrors || !canEdit || !hasChanges) return;
    const elapsed = Date.now() - lastKeystrokeAtRef.current;
    if (elapsed < AUTO_SAVE_DEBOUNCE_MS) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        doAutoSave,
        Math.max(AUTO_SAVE_DEBOUNCE_MS - elapsed, 100)
      );
      return;
    }
    if (saveMutation.isPending || systemSyncMutation.isPending) {
      pendingSaveScheduledRef.current = true;
      return;
    }
    saveMutation.mutate();
  }, [hasErrors, canEdit, hasChanges, saveMutation, systemSyncMutation]);

  doSaveNowRef.current = doSaveNow;
  doAutoSaveRef.current = doAutoSave;

  // Fast save when cursor leaves the cell (few milliseconds after blur)
  const handleClosingBlur = useCallback(() => {
    if (hasErrors || !canEdit || !hasChanges) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      doSaveNowRef.current();
    }, BLUR_SAVE_DEBOUNCE_MS);
  }, [hasErrors, canEdit, hasChanges]);

  useEffect(() => {
    if (!hasChanges || hasErrors || !canEdit) return;
    if (skipAutoSaveDebounceRef.current) {
      skipAutoSaveDebounceRef.current = false;
      return;
    }
    pendingBlurSaveRef.current = false;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(doAutoSave, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    localClosings,
    localComments,
    hasChanges,
    hasErrors,
    canEdit,
    doAutoSave,
  ]);

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
    <div
      className={`flex flex-col overflow-hidden ${
        tableExpanded
          ? "fixed inset-0 z-50 bg-white p-2 dark:bg-slate-900"
          : "fixed inset-0 z-40 flex flex-col bg-slate-100 p-1.5 dark:bg-darkBg xl:relative xl:inset-auto xl:z-auto xl:min-h-0 xl:flex-1 xl:p-6"
      }`}
    >
      {!tableExpanded && (
        <div className="hidden xl:block">
          <PageHeader
            title="Stock taking"
            subtitle={`Bar-style sheet at ${branchName ?? "this branch"}. Opening = latest saved Closing before this date (0 if never saved). Added = GRN receipts on this date. Total Stock = Opening + Added + Added today. Closing = physical count (defaults to Total Stock for unsaved rows so Units Sold starts at 0; editable); Units Sold = Total Stock − Closing.`}
            subtitleRevealOnTitleHover
            icon={FileSpreadsheet}
            fallbackTo={fallbackTo}
          />
        </div>
      )}

      {!tableExpanded && (
        <div className="hidden xl:block">
          <InlineCopilot
            screen="stock-count"
            label="Explain variance"
            defaultQuestion="Stock variance"
            className="mb-3"
          />
        </div>
      )}

      {/* Streamlined responsive action bar: search, reconcile, record sales on mobile/tablet; full controls on desktop */}
      <div className="mb-1.5 flex items-center justify-between gap-1.5 xl:mb-3 xl:gap-4">
        {sheet ? (
          <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
            <div className="flex-1 min-w-0 sm:flex-initial">
              <TableSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search items…"
              />
            </div>
            {/* Total Sales pill for small/smaller screens (< xl) */}
            {!isSyncingOrAdjusting && totals.amount > 0 ? (
              <div
                className="flex xl:hidden shrink-0 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                title="Total sales amount"
              >
                <span className="hidden xs:inline text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mr-1">
                  Tot:
                </span>
                <span>{formatCurrency(totals.amount)}</span>
              </div>
            ) : null}
            {isSyncingStock ? (
              <span
                data-testid="stock-syncing-indicator"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-400/10 dark:text-amber-400"
                title="Synchronizing new stock receipts into sheet"
              >
                <RotateCw className="h-3 w-3 animate-spin" />
                <span className="hidden xs:inline">Syncing stock receipts…</span>
                <span className="xs:hidden">Syncing…</span>
              </span>
            ) : hasChanges ? (
              <span className="hidden shrink-0 text-xs text-amber-600 xl:inline dark:text-amber-400">
                {changedItemIds.size} unsaved change{changedItemIds.size > 1 ? "s" : ""}
              </span>
            ) : latestSavedAt ? (
              <span className="hidden shrink-0 text-xs text-slate-500 xl:inline dark:text-slate-400">
                Last saved: {formatDateTime(latestSavedAt)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Desktop total sales badge before date filter */}
          {!isSyncingOrAdjusting && totals.amount > 0 ? (
            <div
              className="hidden xl:flex shrink-0 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              title="Total sales amount"
            >
              <span className="mr-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Tot:
              </span>
              <span>{formatCurrency(totals.amount)}</span>
            </div>
          ) : null}

          {/* Desktop date navigation */}
          <div className="hidden xl:flex items-center gap-1.5 sm:gap-2">
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
            {!isToday && (
              <button
                type="button"
                onClick={() => changeDate(todayStr())}
                className="rounded-lg border border-primary-300 bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 sm:px-2.5 dark:border-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                title="Jump to today"
              >
                Today
              </button>
            )}
            <span className="mx-0.5 hidden h-4 w-px bg-slate-300 sm:mx-1 sm:block dark:bg-slate-600" aria-hidden />
          </div>

          {/* Refresh button */}
          <Button
            variant="secondary"
            size="md"
            onClick={handleRefreshAll}
            disabled={sheetQuery.isFetching || isSyncingOrAdjusting}
            title="Refresh stock counts"
            aria-label="Refresh stock counts"
            className="p-2 shrink-0"
          >
            <RotateCw
              className={cn(
                "h-4 w-4",
                (sheetQuery.isFetching || isSyncingOrAdjusting) && "animate-spin"
              )}
            />
          </Button>

          {/* PDF button - desktop only */}
          {showPdfButton && !isSyncingOrAdjusting && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleDownloadPdf}
              disabled={!sheet}
              title="Download PDF"
              aria-label="Download"
              className="hidden xl:inline-flex px-2.5 py-1.5 sm:px-4 sm:py-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden xs:inline">Download</span>
            </Button>
          )}

          {/* Save button - desktop only */}
          {showSaveButton && saveButtonActive && !isSyncingOrAdjusting && (
            <Button
              size="md"
              onClick={handleSave}
              className="hidden xl:inline-flex px-2.5 py-1.5 sm:px-4 sm:py-2"
            >
              <Save className="h-4 w-4" />
              <span className="hidden xs:inline">Save</span>
            </Button>
          )}

          {/* Reconcile button - visible on all screens */}
          {showReconcileButton && showReconcileSetting && !isSyncingOrAdjusting && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReconcileClick}
              disabled={reconcileMutation.isPending || saveMutation.isPending}
              title={`Set POS on-hand to match saved closings (${itemsToReconcile} item${itemsToReconcile === 1 ? "" : "s"})`}
              aria-label={`Reconcile (${itemsToReconcile} item${itemsToReconcile === 1 ? "" : "s"})`}
              className="p-2 xl:px-3 xl:py-2 text-xs xl:text-sm shrink-0"
            >
              {reconcileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitCompare className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              )}
              <span className="hidden xl:inline">Reconcile</span>
              {itemsToReconcile > 0 && (
                <span className="ml-1.5 rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-semibold text-primary-800 dark:bg-primary-950/60 dark:text-primary-300">
                  {itemsToReconcile}
                </span>
              )}
            </Button>
          )}

          {/* Record sales button - visible only when sales to record exist */}
          {showRecordSales && !isSyncingOrAdjusting && (
            <Button
              variant="success"
              size="sm"
              onClick={() => void handleRecordSalesClick()}
              title={`Record sales from Sold column (${effectiveUniqueItemsToRecord} item${effectiveUniqueItemsToRecord === 1 ? "" : "s"})`}
              aria-label={`Record sales (${effectiveUniqueItemsToRecord} item${effectiveUniqueItemsToRecord === 1 ? "" : "s"})`}
              disabled={!recordSalesButtonActive || salesPreviewLoading}
              className="p-2 xl:px-3 xl:py-2 text-xs xl:text-sm shrink-0"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden xl:inline">Record sales</span>
              <span className="ml-1.5 rounded-full bg-emerald-700 px-1.5 py-0.5 text-xs text-white">
                {effectiveUniqueItemsToRecord}
              </span>
            </Button>
          )}

          {/* Expand table button - desktop only */}
          <Button
            variant="secondary"
            size="md"
            onClick={() => setTableExpanded((v) => !v)}
            title={tableExpanded ? "Exit full screen" : "Expand table"}
            className="hidden xl:inline-flex px-2.5 py-1.5 sm:px-4 sm:py-2"
            aria-label={tableExpanded ? "Exit full screen" : "Expand table"}
          >
            {tableExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!canEdit && !tableExpanded && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Viewing historical date. Edits are disabled; only dates within the past 14 days (up to 2 weeks ago) are editable.
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
          <div className={tableCard}>
            {isSyncingOrAdjusting ? (
              <div
                data-testid="stock-syncing-spinner"
                className="flex min-h-[350px] flex-1 flex-col items-center justify-center p-8 text-center"
              >
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-9 w-9 animate-spin text-primary-600 dark:text-primary-400" />
                  <div>
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                      Syncing stock adjustments…
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Updating stock counts with latest receipts before displaying table…
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="relative min-h-0 flex-1 overflow-auto scrollbar-blend">
                  <table className="w-full min-w-full divide-y divide-slate-200 xl:min-w-[850px] dark:divide-slate-600">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700">
                <tr>
                  {tableCustom.showRowNumbers && (
                    <TableRowNumberHead className={`w-[2rem] min-w-[2rem] px-0.5 py-1.5 text-center text-xs font-semibold text-slate-700 sm:py-3 sm:text-base dark:text-slate-300 ${tableCustom.densityStyles.th}`} />
                  )}
                  {tableCustom.visibleColumns.map((col) => {
                    let colClass = `${tableHeadCell} ${tableCustom.densityStyles.th}`;
                    let colTitle = "";
                    switch (col.key) {
                      case "item":
                        colClass = `${tableStickyHeadCell} ${tableHeadCell} max-w-[110px] px-2 py-1.5 text-xs sm:max-w-none sm:px-4 sm:py-3 sm:text-lg ${tableCustom.densityStyles.th}`;
                        colTitle = "Product name";
                        break;
                      case "open":
                        colClass = `${tableHeadCell} hidden xl:table-cell ${tableCustom.densityStyles.th}`;
                        colTitle = "Latest saved closing before this date (from your last stock count save)";
                        break;
                      case "added":
                        colClass = `${tableHeadCell} hidden xl:table-cell ${tableCustom.densityStyles.th}`;
                        colTitle = "GRN receipts since your last saved count through this date";
                        break;
                      case "total":
                        colClass = `${tableHeadCell} px-1.5 py-1.5 text-xs sm:px-4 sm:py-3 sm:text-lg ${tableCustom.densityStyles.th}`;
                        colTitle = "Opening + Added + stock-take adds; equals System when counts align with the ledger";
                        break;
                      case "close":
                        colClass = `${tableHeadCell} px-1.5 py-1.5 text-xs sm:px-4 sm:py-3 sm:text-lg ${tableCustom.densityStyles.th}`;
                        colTitle = "Physical count at end of day";
                        break;
                      case "sold":
                        colClass = `${tableHeadCell} px-1.5 py-1.5 text-xs sm:px-4 sm:py-3 sm:text-lg ${tableCustom.densityStyles.th}`;
                        colTitle = "Total Stock − Closing (units sold)";
                        break;
                      case "price":
                        colClass = `${tableHeadCell} hidden xl:table-cell ${tableCustom.densityStyles.th}`;
                        colTitle = "Selling price per unit from price list";
                        break;
                      case "amount":
                        colClass = `${tableHeadCell} px-1.5 py-1.5 text-xs sm:px-4 sm:py-3 sm:text-lg ${tableCustom.densityStyles.th}`;
                        colTitle = "Units Sold × Selling Price (revenue value)";
                        break;
                    }
                    return (
                      <SortableTableHead
                        key={col.key}
                        columnKey={col.key}
                        label={col.label}
                        align={col.align}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        sortable={col.sortable}
                        className={colClass}
                        title={colTitle}
                      />
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {isInitialLoad ? (
                  <TableSkeleton
                    columns={
                      (tableCustom.showRowNumbers ? 1 : 0) +
                      tableCustom.visibleColumns.length
                    }
                    rows={12}
                    columnClassName={(col) => {
                      if (col === 2 || col === 3 || col === 7) return "hidden xl:table-cell";
                      return "";
                    }}
                  />
                ) : paginatedRows.map((r, index) => {
                  const isEven = index % 2 === 1;
                  const zebraClass =
                    tableCustom.zebraStriping && isEven
                      ? tableBodyRowZebra
                      : "";
                  return (
                  <tr
                    key={r.itemId}
                    className={`${tableBodyRow} ${zebraClass}`}
                  >
                    {tableCustom.showRowNumbers && (
                      <TableRowNumberCell
                        page={page}
                        pageSize={pageSize}
                        indexInPage={index}
                        className={`w-[2rem] min-w-[2rem] px-0.5 py-1.5 text-center text-xs tabular-nums text-slate-600 sm:py-2.5 sm:text-base dark:text-slate-400 ${tableCustom.densityStyles.td}`}
                      />
                    )}
                    {tableCustom.visibleColumns.map((col) => {
                      const alignClass =
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left";

                      switch (col.key) {
                        case "item":
                          return (
                            <td
                              key={col.key}
                              className={`${tableStickyFirstBody} max-w-[110px] truncate px-2 py-1.5 text-xs sm:max-w-none sm:px-4 sm:py-2.5 sm:text-lg ${tableCustom.densityStyles.td}`}
                            >
                              {r.name || "—"}
                            </td>
                          );
                        case "open":
                          return (
                            <td
                              key={col.key}
                              className={`${tableBodyCellNumDebts} hidden xl:table-cell ${tableCustom.densityStyles.td} ${alignClass}`}
                            >
                              {formatQty(r.openingStock)}
                            </td>
                          );
                        case "added":
                          return (
                            <td
                              key={col.key}
                              className={`${tableBodyCellNumDebts} hidden xl:table-cell ${tableCustom.densityStyles.td} ${alignClass}`}
                            >
                              {formatQty(r.addedStock)}
                            </td>
                          );
                        case "total":
                          return (
                            <td
                              key={col.key}
                              className={`px-1.5 py-1.5 ${alignClass} text-xs tabular-nums text-slate-600 sm:px-4 sm:py-2.5 sm:text-lg dark:text-slate-400 ${tableCustom.densityStyles.td}`}
                            >
                              {formatQty(r.totalStock)}
                            </td>
                          );
                        case "close":
                          return (
                            <td
                              key={col.key}
                              className={`${canEdit ? `px-1.5 py-1.5 ${alignClass} text-xs sm:px-4 sm:py-2.5 sm:text-lg` : tableBodyCellNumDebts} ${tableCustom.densityStyles.td}`}
                            >
                              {canEdit ? (
                                <div
                                  className={cn(
                                    "flex flex-col",
                                    col.align === "right"
                                      ? "items-end"
                                      : col.align === "center"
                                      ? "items-center"
                                      : "items-start"
                                  )}
                                >
                                  <input
                                    ref={(el) => {
                                      inputRefs.current[index] = el;
                                    }}
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*\.?[0-9]{0,2}"
                                    value={
                                      r.itemId in localClosings
                                        ? localClosings[r.itemId]
                                        : formatQtyInput(r.closingStock)
                                    }
                                    onChange={(e) =>
                                      handleClosingChange(r.itemId, e.target.value)
                                    }
                                    onBlur={handleClosingBlur}
                                    onClick={(e) => {
                                      const el = e.currentTarget;
                                      const len = el.value.length;
                                      el.setSelectionRange(len, len);
                                    }}
                                    onFocus={(e) => {
                                      const el = e.currentTarget;
                                      const len = el.value.length;
                                      el.setSelectionRange(len, len);
                                    }}
                                    onKeyDown={(e) => {
                                      const maxPage = Math.max(
                                        0,
                                        Math.ceil(computedRows.length / pageSize) - 1
                                      );
                                      if (e.key === "Enter" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        if (index + 1 < paginatedRows.length) {
                                          inputRefs.current[index + 1]?.focus();
                                        } else if (page < maxPage) {
                                          setPage((p) => p + 1);
                                          pendingFocusIndexRef.current = 0;
                                        }
                                      } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        if (index - 1 >= 0) {
                                          inputRefs.current[index - 1]?.focus();
                                        } else if (page > 0) {
                                          setPage((p) => p - 1);
                                          pendingFocusIndexRef.current = pageSize - 1;
                                        }
                                      }
                                    }}
                                    className={`w-14 rounded border px-1 py-0.5 ${alignClass} text-xs font-semibold tabular-nums focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-24 sm:px-2 sm:py-1 sm:text-xl ${
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
                                  {!r.closingError && r.closingStale && (
                                    <span className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                                      Stock added — save to update
                                    </span>
                                  )}
                                  {!r.closingError && !r.closingStale && r.closingUnsaved && (
                                    <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium sm:text-xs">
                                      {savingItemIds.has(r.itemId) ? (
                                        <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                                          <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin shrink-0" />
                                          Saving…
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 dark:text-amber-400">Not saved</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                formatQty(r.closingStock)
                              )}
                            </td>
                          );
                        case "sold":
                          return (
                            <td
                              key={col.key}
                              className={`px-1.5 py-1.5 ${alignClass} text-xs tabular-nums text-slate-600 sm:px-4 sm:py-2.5 sm:text-lg dark:text-slate-400 ${tableCustom.densityStyles.td}`}
                            >
                              <div
                                className={cn(
                                  "flex items-center gap-1 sm:gap-1.5",
                                  col.align === "right"
                                    ? "justify-end"
                                    : col.align === "center"
                                    ? "justify-center"
                                    : "justify-start"
                                )}
                              >
                                <span>{formatQty(r.unitsSold)}</span>
                                {(() => {
                                  const already = alreadyRecordedByItem[r.itemId] ?? 0;
                                  if (already <= 0) return null;
                                  const toRecord = Math.max(0, roundQty((r.unitsSold ?? 0) - already));
                                  const isFullyRecorded = toRecord <= 0;
                                  return (
                                    <span
                                      className={cn(
                                        "inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-xs sm:text-sm font-bold leading-none shrink-0",
                                        isFullyRecorded
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                          : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                                      )}
                                      title={
                                        isFullyRecorded
                                          ? `Recorded: ${formatQty(already)}`
                                          : `${formatQty(already)} recorded · ${formatQty(toRecord)} new`
                                      }
                                    >
                                      S
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>
                          );
                        case "price":
                          return (
                            <td
                              key={col.key}
                              className={`${tableBodyCellNumDebts} hidden xl:table-cell ${tableCustom.densityStyles.td} ${alignClass}`}
                            >
                              {formatAmount(r.sellingPrice)}
                            </td>
                          );
                        case "amount":
                          return (
                            <td
                              key={col.key}
                              className={`px-1.5 py-1.5 ${alignClass} text-xs tabular-nums font-bold text-slate-700 sm:px-4 sm:py-2.5 sm:text-lg dark:text-slate-300 ${tableCustom.densityStyles.td}`}
                            >
                              {formatAmount(r.amount)}
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {computedRows.length > 0 && (
              <div className="hidden xl:block">
                <Pagination
                  page={page}
                  size={pageSize}
                  totalElements={computedRows.length}
                  onPageChange={setPage}
                  onSizeChange={(s) => {
                    setPageSize(s);
                    setStoredTablePageSize(s, "std-stock-count");
                    setPage(0);
                  }}
                  storageKey="std-stock-count"
                  sizeOptions={[10, 15, 25, 50, 100, 200]}
                  onRefresh={() => void refetch()}
                  isRefreshing={isRefreshing}
                />
              </div>
            )}

            {/* Mobile/tablet-only compact pager at bottom of table */}
            {computedRows.length > pageSize && (
              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 xl:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span className="font-medium">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, computedRows.length)} of {computedRows.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-semibold">
                    {page + 1} / {Math.ceil(computedRows.length / pageSize)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(Math.ceil(computedRows.length / pageSize) - 1, p + 1))}
                    disabled={page >= Math.ceil(computedRows.length / pageSize) - 1}
                    className="rounded p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
              </>
            )}
          </div>

          {!isSyncingOrAdjusting && (dayDebtsTotal > 0 || allDebtsTotal > 0 || (analytics?.expenseIntelligence?.todayTotal ?? 0) > 0 || totals.amount > 0) && (
            <div className={`mt-4 hidden xl:flex flex-wrap justify-end gap-1.5 sm:gap-3 ${tableExpanded ? "!hidden" : ""}`}>
              {dayDebtsTotal > 0 && (
                <StatChip
                  label="Today Debts"
                  value={formatCurrency(dayDebtsTotal)}
                  tone="debt"
                  onClick={dayDebts.length > 0 ? () => setDebtModal("day") : undefined}
                />
              )}
              {allDebtsTotal > 0 && (
                <StatChip
                  label="Total Debts"
                  value={formatCurrency(allDebtsTotal)}
                  tone="debt"
                  onClick={allDebts.length > 0 ? () => setDebtModal("all") : undefined}
                />
              )}
              {(analytics?.expenseIntelligence?.todayTotal ?? 0) > 0 && (
                <StatChip
                  label="Expenses"
                  value={formatCurrency(analytics?.expenseIntelligence?.todayTotal ?? 0)}
                  tone="expense"
                />
              )}
              {totals.amount > 0 && (
                <StatChip
                  label="Total Sales"
                  value={formatCurrency(totals.amount)}
                  tone="sales"
                />
              )}
            </div>
          )}

          {!isSyncingOrAdjusting && computedRows.length === 0 && (
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
                        {d.customerPhone ?? "—"} · Issued by: {d.issuedBy ?? "—"} · Due: {formatDate(d.dueDate)}
                        {debtModal === "all" ? ` · Recorded: ${formatDate(d.createdAt)}` : ""}
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
        confirmLabel="Save"
        variant="primary"
        loading={saveMutation.isPending || previewLoading}
      />

      <Modal
        open={reconcileModalOpen}
        onClose={() => setReconcileModalOpen(false)}
        title="Reconcile inventory to closings"
        maxWidth="max-w-4xl"
        scrollMaxHeight="max-h-[90vh]"
        scrollable
      >
        {cachedReconcilePreview && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="shrink-0 text-sm text-slate-600 dark:text-slate-300">
              POS on-hand will be set to today&apos;s saved{" "}
              <span className="font-semibold text-slate-900 dark:text-white">Closing</span> for{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {cachedReconcilePreview.itemsAdjusted} item(s)
              </span>{" "}
              on {dateStr}.
            </p>
            {searchQuery.trim().length > 0 && (
              <p className="shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                Table filter is active — reconcile still uses the full sheet.
              </p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Item
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                      On hand (now)
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Reconcile to (closing)
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Adjustment
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {cachedReconcilePreview.lines.map((line) => (
                    <tr key={line.itemId}>
                      <td className="px-3 py-2 text-sm text-slate-900 dark:text-white">
                        {line.name}
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                        {formatQty(line.onHandQty)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatQty(line.closingStock)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right text-sm tabular-nums font-semibold ${
                          line.variance > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {formatQtyVariance(line.variance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cachedReconcilePreview.itemsAlreadyMatched > 0 && (
              <p className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
                {cachedReconcilePreview.itemsAlreadyMatched} other item(s) already match and will
                not be changed.
              </p>
            )}
            <ModalFooter className="shrink-0 border-slate-200 pt-4 dark:border-slate-600">
              <button
                type="button"
                onClick={handleReconcileProceed}
                disabled={reconcileMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600 shrink-0"
              >
                {reconcileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitCompare className="h-4 w-4" />
                )}
                Reconcile
              </button>
              <button
                type="button"
                onClick={() => setReconcileModalOpen(false)}
                disabled={reconcileMutation.isPending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 shrink-0"
              >
                Cancel
              </button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      <SlideOver
        open={recordPreview !== null}
        onClose={() => setRecordPreview(null)}
        title="Record sales from stock count"
        headerAction={
          <IconButton
            variant="bordered"
            onClick={handleRefreshPreview}
            disabled={isRefreshingPreview}
            title="Refresh preview items"
            aria-label="Refresh preview items"
          >
            <RotateCw className={cn("h-4 w-4", isRefreshingPreview && "animate-spin")} />
          </IconButton>
        }
      >
        {recordPreview && (
          <div className="flex flex-col gap-4">
            {recordPreview.totalQtyToRecord <= 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                All {recordPreview.lines.length} products up to date for {dateStr}. No new sales to record.
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Record{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {recordPreviewLinesWithQty} of {recordPreview.lines.length} products
                </span>{" "}
                for {dateStr}. Post sales &amp; deduct inventory.
              </p>
            )}
            {recordablePreviewLines.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Implied
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Recorded
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                        To record
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Amt
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
                          {formatQty(line.impliedSold)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                          {formatQty(line.alreadyRecorded)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatQty(line.qtyToRecord)}
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
            <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
              <div className="mb-3 flex items-baseline gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  Total {formatAmount(recordPreview.totalValueToRecord)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => recordSalesMutation.mutate()}
                  disabled={
                    recordPreview.totalQtyToRecord <= 0 || recordSalesMutation.isPending
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {recordSalesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  Record
                </button>
                <button
                  type="button"
                  onClick={() => setRecordPreview(null)}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-200 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
