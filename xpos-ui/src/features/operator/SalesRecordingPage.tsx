import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistedSearch } from "@/hooks/usePersistedSearch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  NotebookPen,
  RefreshCcw,
  TrendingUp,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import { fetchAllOrgItems } from "@/api/items";
import { fetchStockLevels } from "@/api/stockLevels";
import {
  fetchSalesRecordingStats,
  recordHistoricalSales,
  type SalesRecordingEntry,
} from "@/api/salesRecording";
import {
  fetchSalesRecordingDraft,
  saveSalesRecordingDraft,
} from "@/api/salesRecordingDraft";
import { Pagination } from "@/components/ui/Pagination";
import {
  Button,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  StatChip,
  tableBodyCell,
  tableBodyCellNumDebts,
  tableBodyRow,
  tableCard,
  tableEmptyCell,
  tableHeadCell,
  tableStickyFirstBody,
  tableStickyHeadCell,
  DateInput,
} from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatAmount } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";
import { formatQty, parseQty } from "@/utils/formatQuantity";
import { rowMatchesSearch } from "@/utils/tableSearchMatch";
import { sortTableRows } from "@/utils/tableSort";
import { useToast } from "@/contexts/ToastContext";
import { useTableSort } from "@/hooks/useTableSort";
import type { Item } from "@/types/catalog";

const BACKDATE_MAX_DAYS = 7;
const DRAFT_SAVE_DEBOUNCE_MS = 300;
const PAGE_SIZE_OPTIONS = [10, 15, 25];
const DEFAULT_PAGE_SIZE = 15;

function formatRelativeTime(date: Date, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIso(): string {
  return toIsoDate(new Date());
}

function minDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - BACKDATE_MAX_DAYS);
  return toIsoDate(d);
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function roundTo2dp(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Row {
  item: Item;
  qtyRaw: string;
}

interface SaveDraftVars {
  orgId: string;
  branchId: string;
  terminalId: string;
  saleDate: string;
  qtyMap: Record<string, string>;
}

export function SalesRecordingPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const terminalId = useAppSelector(selectTerminalId);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [saleDate, setSaleDate] = useState<string>(todayIso());
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const [search, setSearch] = usePersistedSearch();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const { sortColumn, sortDirection, toggleSort } = useTableSort();
  const saveTimerRef = useRef<number | null>(null);
  const hydratedKeyRef = useRef<string | null>(null);

  const draftScopeKey =
    orgId && branchId && terminalId && saleDate
      ? `${orgId}:${branchId}:${terminalId}:${saleDate}`
      : null;

  // Fetch the server-side draft whenever scope changes. We manage this with a plain useEffect
  // (rather than useQuery) because we need deterministic, race-free behavior: every scope
  // change must clear local state and kick off a fresh fetch, and the response must hydrate
  // only if the scope hasn't changed again. TanStack Query's observer/structural-sharing
  // internals made this brittle in StrictMode — a stale observer or a same-reference response
  // could prevent the hydration effect from ever firing for the newly picked date.
  useEffect(() => {
    if (!token || !orgId || !branchId || !terminalId || !saleDate) {
      setQtyByItem({});
      setLastSavedAt(null);
      setDraftSaveError(false);
      hydratedKeyRef.current = null;
      return;
    }
    const scope = `${orgId}:${branchId}:${terminalId}:${saleDate}`;
    let cancelled = false;
    hydratedKeyRef.current = null;
    setQtyByItem({});
    setLastSavedAt(null);
    setDraftSaveError(false);
    fetchSalesRecordingDraft(token, orgId, branchId, terminalId, saleDate)
      .then((resp) => {
        if (cancelled) return;
        // If the user has already started typing for this scope, handleQtyChange will have
        // claimed the ref — don't overwrite their in-progress input with the fetched draft.
        if (hydratedKeyRef.current === scope) return;
        setQtyByItem(resp.qtyByItem ?? {});
        setLastSavedAt(resp.updatedAt ? new Date(resp.updatedAt) : null);
        setDraftSaveError(false);
        hydratedKeyRef.current = scope;
      })
      .catch(() => {
        // If the load fails (e.g. network blip), leave inputs empty — user can retry by
        // re-picking the date. Don't flag draftSaveError, which is reserved for save failures.
      });
    return () => {
      cancelled = true;
    };
  }, [token, orgId, branchId, terminalId, saleDate]);

  useEffect(() => {
    if (!lastSavedAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [lastSavedAt]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const saveDraftMutation = useMutation({
    mutationFn: (vars: SaveDraftVars) =>
      saveSalesRecordingDraft(
        token,
        vars.orgId,
        vars.branchId,
        vars.terminalId,
        vars.saleDate,
        vars.qtyMap
      ),
    onSuccess: (resp, vars) => {
      // Only reflect save status in the UI if the user is still on the scope the save targeted —
      // otherwise a late-firing debounce could claim "Draft saved" for a date the user already left.
      if (
        orgId === vars.orgId &&
        branchId === vars.branchId &&
        terminalId === vars.terminalId &&
        saleDate === vars.saleDate
      ) {
        setLastSavedAt(resp.updatedAt ? new Date(resp.updatedAt) : new Date());
        setDraftSaveError(false);
        setNowMs(Date.now());
      }
      // Nothing to write back to a query cache — the draft is loaded via a plain useEffect
      // fetch, not useQuery. The server response is already reflected in local state above.
      void resp;
    },
    onError: (_err, vars) => {
      if (
        orgId === vars.orgId &&
        branchId === vars.branchId &&
        terminalId === vars.terminalId &&
        saleDate === vars.saleDate
      ) {
        setDraftSaveError(true);
      }
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["sales-recording-items", orgId],
    queryFn: () => fetchAllOrgItems(token, orgId!),
    enabled: Boolean(token && orgId),
    staleTime: 60_000,
  });

  const priceableItems = useMemo(() => {
    const items = itemsQuery.data ?? [];
    return items.filter(
      (i) =>
        i.active &&
        i.defaultSellingPrice != null &&
        Number(i.defaultSellingPrice) > 0
    );
  }, [itemsQuery.data]);

  const itemIds = useMemo(
    () => priceableItems.map((i) => i.id),
    [priceableItems]
  );

  const stockLevelsQuery = useQuery({
    queryKey: ["sales-recording-stock", orgId, branchId, itemIds],
    queryFn: () => fetchStockLevels(token, orgId!, branchId!, itemIds),
    enabled: Boolean(token && orgId && branchId && itemIds.length > 0),
    staleTime: 30_000,
  });

  const stockByItem = useMemo(() => {
    const map: Record<string, number> = {};
    (stockLevelsQuery.data ?? []).forEach((s) => {
      map[s.itemId] = s.onHandQty;
    });
    return map;
  }, [stockLevelsQuery.data]);

  const sellableItems = useMemo(() => {
    return priceableItems.filter((i) => {
      if (!i.trackInventory) return false;
      const onHand = stockByItem[i.id];
      if (onHand == null) return true;
      return onHand > 0;
    });
  }, [priceableItems, stockByItem]);

  const statsQuery = useQuery({
    queryKey: ["sales-recording-stats", orgId, branchId, terminalId, saleDate],
    queryFn: () =>
      fetchSalesRecordingStats(token, orgId!, branchId!, terminalId!, saleDate),
    enabled: Boolean(token && orgId && branchId && terminalId && saleDate),
    staleTime: 15_000,
  });

  const soldQtyByItem = useMemo(() => {
    const map: Record<string, number> = {};
    (statsQuery.data?.soldByItem ?? []).forEach((s) => {
      map[s.itemId] = Number(s.qtySold);
    });
    return map;
  }, [statsQuery.data]);

  const soldValueByItem = useMemo(() => {
    const map: Record<string, number> = {};
    (statsQuery.data?.soldByItem ?? []).forEach((s) => {
      map[s.itemId] = Number(s.totalValue);
    });
    return map;
  }, [statsQuery.data]);

  const rows = useMemo<Row[]>(() => {
    return sellableItems
      .filter((i) =>
        rowMatchesSearch({ ...i, qtyRaw: qtyByItem[i.id] ?? "" }, search)
      )
      .map((item) => ({ item, qtyRaw: qtyByItem[item.id] ?? "" }));
  }, [sellableItems, qtyByItem, search]);

  useEffect(() => {
    setPage(0);
  }, [search, pageSize, sortColumn, sortDirection]);

  const sortedRows = useMemo(
    () =>
      sortTableRows(
        rows,
        { column: sortColumn, direction: sortDirection },
        (row, column) => {
          if (column === "item") return row.item.name;
          if (column === "sku") return row.item.sku ?? "";
          if (column === "qty") return Number(row.qtyRaw) || 0;
          if (column === "onHand") return stockByItem[row.item.id] ?? 0;
          if (column === "price") return Number(row.item.defaultSellingPrice ?? 0);
          if (column === "lineTotal") {
            return (Number(row.qtyRaw) || 0) * Number(row.item.defaultSellingPrice ?? 0);
          }
          return null;
        }
      ),
    [rows, sortColumn, sortDirection, stockByItem]
  );

  const pageRows = useMemo<Row[]>(() => {
    const start = page * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const batchSummary = useMemo(() => {
    let total = 0;
    let units = 0;
    const entries: SalesRecordingEntry[] = [];
    let invalid = false;
    Object.entries(qtyByItem).forEach(([itemId, raw]) => {
      if (!raw || raw.trim() === "") return;
      const qty = parseQty(raw);
      if (qty == null) {
        invalid = true;
        return;
      }
      if (qty <= 0) return;
      const item = sellableItems.find((it) => it.id === itemId);
      if (!item || item.defaultSellingPrice == null) return;
      const price = Number(item.defaultSellingPrice);
      total += qty * price;
      units += qty;
      entries.push({ itemId, qty });
    });
    return { total: roundTo2dp(total), units, entries, invalid };
  }, [qtyByItem, sellableItems]);

  const recordMutation = useMutation({
    mutationFn: () =>
      recordHistoricalSales(token, orgId!, branchId!, terminalId!, {
        saleDate,
        entries: batchSummary.entries,
      }),
    onSuccess: (resp) => {
      toast.success(
        `Recorded ${resp.createdSaleIds.length} sale(s) for ${resp.saleDate}.`,
        { title: "Sales Recording" }
      );
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Backend auto-clears the draft on a successful batch; mirror that locally.
      setQtyByItem({});
      setLastSavedAt(null);
      setDraftSaveError(false);
      hydratedKeyRef.current = null;
      queryClient.invalidateQueries({
        queryKey: ["sales-recording-stock", orgId, branchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["sales-recording-stats", orgId, branchId, terminalId, saleDate],
      });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        title: "Sales Recording failed",
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const canSubmit =
    !recordMutation.isPending &&
    !batchSummary.invalid &&
    batchSummary.entries.length > 0;

  const scheduleDraftSave = (next: Record<string, string>) => {
    if (!orgId || !branchId || !terminalId || !saleDate) return;
    // Capture the scope at schedule time. When the 300ms debounce fires, we must save to the
    // date/branch/terminal the user was on when they typed — not whatever saleDate the
    // latest render happens to have if the user switched dates during the debounce window.
    const target: SaveDraftVars = {
      orgId,
      branchId,
      terminalId,
      saleDate,
      qtyMap: {},
    };
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      // Strip blanks: the server also normalises, but this keeps the request small.
      const clean: Record<string, string> = {};
      for (const [itemId, raw] of Object.entries(next)) {
        if (raw && raw.trim() !== "") {
          clean[itemId] = raw.trim();
        }
      }
      saveDraftMutation.mutate({ ...target, qtyMap: clean });
    }, DRAFT_SAVE_DEBOUNCE_MS);
  };

  const handleQtyChange = (itemId: string, value: string) => {
    // Claim hydration for this scope as soon as the user touches it. Otherwise, if the user
    // types before the draft query has resolved (common on a past date that was just picked),
    // the hydration effect would run on arrival and overwrite the typed value with server data.
    if (draftScopeKey != null) {
      hydratedKeyRef.current = draftScopeKey;
    }
    setQtyByItem((prev) => {
      const next = { ...prev, [itemId]: value };
      scheduleDraftSave(next);
      return next;
    });
  };

  const rowError = (item: Item, raw: string): string | null => {
    if (!raw || raw.trim() === "") return null;
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) return "Max 2 decimals.";
    const qty = Number(raw);
    if (qty <= 0) return null;
    if (item.trackInventory) {
      const onHand = stockByItem[item.id] ?? 0;
      if (qty > onHand) return `Only ${formatQty(onHand)} in stock.`;
    }
    return null;
  };

  const refreshStock = () => {
    queryClient.invalidateQueries({
      queryKey: ["sales-recording-stock", orgId, branchId, itemIds],
    });
  };

  return (
    <div className="w-full p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:mb-6">
        <PageHeader
          title="Sales Recording"
          icon={NotebookPen}
          fallbackTo="/operator"
          noMargin
          className="min-w-0 flex-1"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showAnalytics}
              onChange={(e) => setShowAnalytics(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:bg-slate-600 dark:after:border-slate-500 dark:peer-focus:ring-primary-800" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Show analytics
            </span>
          </label>
          <button
            type="button"
            onClick={refreshStock}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh stock
          </button>
        </div>
      </div>

      {showAnalytics && (
        <StatsCards stats={statsQuery.data} loading={statsQuery.isLoading} />
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="search"
            placeholder="Search all columns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none sm:w-64 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const next = shiftIsoDate(saleDate, -1);
                  if (next >= minDateIso()) setSaleDate(next);
                }}
                disabled={saleDate <= minDateIso()}
                aria-label="Previous day"
                className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <DateInput
                value={saleDate}
                min={minDateIso()}
                max={todayIso()}
                onChange={(e) => setSaleDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => {
                  const next = shiftIsoDate(saleDate, 1);
                  if (next <= todayIso()) setSaleDate(next);
                }}
                disabled={saleDate >= todayIso()}
                aria-label="Next day"
                className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-slate-600 dark:text-slate-400">
          <span>
            Qty: <span className="font-semibold">{formatQty(batchSummary.units)}</span>
          </span>
          <span>
            Total (KSH):{" "}
            <span className="font-semibold">{formatAmount(batchSummary.total)}</span>
          </span>
          {saveDraftMutation.isPending ? (
            <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving draft…
            </span>
          ) : draftSaveError ? (
            <span
              className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400"
              title="Draft save failed — we'll retry on the next change."
            >
              <AlertTriangle className="h-4 w-4" />
              Draft not saved
            </span>
          ) : lastSavedAt ? (
            <span
              className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400"
              title={formatDateTime(lastSavedAt)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Draft saved · {formatRelativeTime(lastSavedAt, nowMs)}
            </span>
          ) : null}
          {batchSummary.entries.length > 0 && (
            <button
              type="button"
              onClick={() => recordMutation.mutate()}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-base font-semibold text-white shadow-lg shadow-primary-500/30 ring-1 ring-primary-400/40 transition hover:from-primary-400 hover:to-primary-500 hover:shadow-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-primary-900/60 dark:ring-primary-400/30"
            >
              {recordMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <NotebookPen className="h-5 w-5" />
              )}
              Record {batchSummary.entries.length} sale{batchSummary.entries.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      <div className={tableCard}>
        <div className="overflow-x-auto">
          <table className="w-full table-auto divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "640px" }}>
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <TableRowNumberHead />
                <SortableTableHead
                  columnKey="item"
                  label="Item"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className={`${tableStickyHeadCell} ${tableHeadCell} max-w-[11rem] sm:max-w-[14rem]`}
                />
                <SortableTableHead
                  columnKey="sku"
                  label="SKU"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className={`${tableHeadCell} whitespace-nowrap`}
                />
                <SortableTableHead
                  columnKey="onHand"
                  label="On hand"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  sortable={false}
                  className={`${tableHeadCell} whitespace-nowrap`}
                />
                <SortableTableHead
                  columnKey="price"
                  label="Price (KSH)"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  sortable={false}
                  className={`${tableHeadCell} whitespace-nowrap`}
                />
                <SortableTableHead
                  columnKey="qty"
                  label="Sold qty"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className={`${tableHeadCell} min-w-[8.5rem] whitespace-nowrap`}
                />
                <SortableTableHead
                  columnKey="lineTotal"
                  label="Line total (KSH)"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  sortable={false}
                  className={`${tableHeadCell} whitespace-nowrap`}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
              {itemsQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className={tableEmptyCell}>
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={tableEmptyCell}>
                    No sellable items found.
                  </td>
                </tr>
              ) : (
                pageRows.map(({ item, qtyRaw }, index) => {
                  const price = Number(item.defaultSellingPrice ?? 0);
                  const qty = Number(qtyRaw) || 0;
                  const lineTotal = qty * price;
                  const err = rowError(item, qtyRaw);
                  const onHand = stockByItem[item.id];
                  const savedQty = soldQtyByItem[item.id] ?? 0;
                  const savedValue = soldValueByItem[item.id] ?? 0;
                  const hasDraft = qty > 0 && !err;
                  return (
                    <tr key={item.id} className={tableBodyRow}>
                    <TableRowNumberCell page={page} pageSize={pageSize} indexInPage={index} />
                      <td className={`${tableStickyFirstBody} max-w-[11rem] sm:max-w-[14rem]`}>
                        <span className="block truncate" title={item.name}>
                          {item.name}
                        </span>
                      </td>
                      <td className={`${tableBodyCell} whitespace-nowrap`}>
                        {item.sku ?? "—"}
                      </td>
                      <td className={`${tableBodyCellNumDebts} whitespace-nowrap`}>
                        {item.trackInventory
                          ? onHand != null
                            ? formatQty(onHand)
                            : "—"
                          : "N/A"}
                      </td>
                      <td className={`${tableBodyCellNumDebts} whitespace-nowrap`}>
                        {formatAmount(price)}
                      </td>
                      <td className={`${tableBodyCell} min-w-[8.5rem]`}>
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={qtyRaw}
                            onChange={(e) =>
                              handleQtyChange(item.id, e.target.value)
                            }
                            placeholder="0"
                            aria-label={`Draft quantity for ${item.name}`}
                            className={`w-[4.5rem] max-w-full rounded border bg-white px-2 py-1 text-left text-lg tabular-nums focus:outline-none sm:text-xl dark:bg-slate-700 ${
                                err
                                  ? "border-red-400 text-red-700 focus:border-red-500 dark:border-red-500 dark:text-red-300"
                                  : hasDraft
                                    ? "border-amber-400 text-amber-700 focus:border-amber-500 dark:border-amber-500 dark:text-amber-300"
                                    : "border-slate-300 focus:border-primary dark:border-slate-600 dark:text-white"
                              }`}
                            />
                          {savedQty > 0 && (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              {formatQty(savedQty)}
                            </span>
                          )}
                          {err && (
                            <p className="text-sm text-red-500">{err}</p>
                          )}
                        </div>
                      </td>
                      <td className={`${tableBodyCellNumDebts} whitespace-nowrap`}>
                        <div className="flex items-center gap-1.5">
                          {qty > 0 ? (
                            <span>{formatAmount(lineTotal)}</span>
                          ) : savedValue > 0 ? null : (
                            <span>—</span>
                          )}
                          {savedValue > 0 && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                              {formatAmount(savedValue)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <Pagination
            page={page}
            size={pageSize}
            totalElements={sortedRows.length}
            onPageChange={setPage}
            onSizeChange={setPageSize}
            sizeOptions={PAGE_SIZE_OPTIONS}
            onRefresh={() => {
              void itemsQuery.refetch();
              void stockLevelsQuery.refetch();
              void statsQuery.refetch();
            }}
            isRefreshing={
              itemsQuery.isFetching || stockLevelsQuery.isFetching || statsQuery.isFetching
            }
          />
        )}
      </div>
    </div>
  );
}

interface StatsProps {
  stats:
    | {
        totalSalesValue: number;
        totalItemsSold: number;
        saleCount: number;
        topSellingItems: { itemId: string; itemName: string; qtySold: number; totalValue: number }[];
        lowStockItems: { itemId: string; itemName: string; onHandQty: number }[];
      }
    | undefined;
  loading: boolean;
}

function StatsCards({ stats, loading }: StatsProps) {
  const [insightsOpen, setInsightsOpen] = useState(false);
  const total = stats?.totalSalesValue ?? 0;
  const items = stats?.totalItemsSold ?? 0;
  const count = stats?.saleCount ?? 0;
  const top = stats?.topSellingItems ?? [];
  const low = stats?.lowStockItems ?? [];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatChip
          label="Total sales (KSH)"
          value={loading ? "…" : formatAmount(total)}
          tone="sales"
        />
        <StatChip
          label="Items sold"
          value={loading ? "…" : formatQty(items)}
          tone="neutral"
        />
        <StatChip
          label="Sales recorded"
          value={loading ? "…" : String(count)}
          tone="neutral"
        />
        <StatChip
          label="Low stock"
          value={loading ? "…" : String(low.length)}
          tone="debt"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          onClick={() => setInsightsOpen(true)}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          View insights
          {low.length > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/95 px-1.5 text-xs font-bold text-amber-700">
              {low.length}
            </span>
          )}
        </Button>
      </div>
      {insightsOpen && (
        <InsightsModal
          top={top}
          low={low}
          onClose={() => setInsightsOpen(false)}
        />
      )}
    </div>
  );
}

interface InsightsModalProps {
  top: { itemId: string; itemName: string; qtySold: number; totalValue: number }[];
  low: { itemId: string; itemName: string; onHandQty: number }[];
  onClose: () => void;
}

function InsightsModal({ top, low, onClose }: InsightsModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insights-modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/60"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h3
            id="insights-modal-title"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"
          >
            <BarChart3 className="h-5 w-5" /> Insights
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 overflow-y-auto p-5 md:grid-cols-2">
          <section>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <TrendingUp className="h-4 w-4" /> Top selling items
            </h4>
            {top.length === 0 ? (
              <p className="text-sm text-slate-500">
                No sales recorded for this date.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-600">
                {top.map((t) => (
                  <li
                    key={t.itemId}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {t.itemName}
                    </span>
                    <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {formatQty(t.qtySold)} &middot;{" "}
                      {formatAmount(t.totalValue)} KSH
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <AlertTriangle className="h-4 w-4" /> Low stock alerts
            </h4>
            {low.length === 0 ? (
              <p className="text-sm text-slate-500">
                All items above reorder level.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-600">
                {low.map((l) => (
                  <li
                    key={l.itemId}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {l.itemName}
                    </span>
                    <span className="whitespace-nowrap text-amber-600 dark:text-amber-400">
                      {formatQty(l.onHandQty)} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

