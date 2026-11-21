import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
} from "@/store/selectors/orgContextSelectors";
import {
  fetchManualStockCountSheet,
  saveManualStockCountSheet,
  type ManualStockCountLineSaveRequest,
} from "@/api/manualStockCount";
import { fetchAllOrgItems } from "@/api/items";
import { formatCurrency, formatAmount } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";
import {
  formatQty,
  formatQtyVariance,
  isValidQtyInput,
  parseQty,
  roundQty,
} from "@/utils/formatQuantity";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import {
  getSavedStockCountDate,
  saveStockCountDate,
} from "@/utils/datePersistenceStorage";
import { generateUuid } from "@/utils/uuid";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  StatChip,
  TableSearchInput,
  tableBodyRow,
  tableStickyHeadCell,
  tableHeadCell,
  tableBodyCell,
  tableBodyCellNum,
  tableStickyFirstBody,
  tableEmptyCell,
} from "@/components/ui";
import { useDataTable } from "@/hooks/useDataTable";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { Item } from "@/types/catalog";

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

interface LocalRow {
  clientId: string;
  serverId: string | null;
  itemId: string | null;
  itemName: string;
  sku: string;
  opening: string;
  added: string;
  closing: string;
  system: string;
  sellingPrice: string;
  comments: string;
  lineOrder: number;
}

const MANUAL_STOCK_SORT = {
  item: (row: LocalRow) => row.itemName,
  open: (row: LocalRow) => parseNonNegQtyField(row.opening, 0),
  added: (row: LocalRow) => parseNonNegQtyField(row.added, 0),
  total: (row: LocalRow) => computePreview(row).total,
  close: (row: LocalRow) => parseOptionalQtyField(row.closing) ?? Number.NEGATIVE_INFINITY,
  sys: (row: LocalRow) => parseOptionalQtyField(row.system) ?? Number.NEGATIVE_INFINITY,
  var: (row: LocalRow) => computePreview(row).variance ?? Number.NEGATIVE_INFINITY,
  sold: (row: LocalRow) => computePreview(row).unitsSold,
  price: (row: LocalRow) => parsePrice(row.sellingPrice),
  amount: (row: LocalRow) => computePreview(row).amount,
};

function serverRowToLocal(r: import("@/api/manualStockCount").ManualStockCountLineResponse): LocalRow {
  const combinedAdded = r.addedQty + r.addedTodayQty;
  return {
    clientId: r.id,
    serverId: r.id,
    itemId: r.itemId,
    itemName: r.itemName,
    sku: r.sku ?? "",
    opening: r.openingQty != null ? formatQty(r.openingQty) : "",
    added: formatQty(combinedAdded),
    closing: r.closingQty != null ? formatQty(r.closingQty) : "",
    system: r.systemQty != null ? formatQty(r.systemQty) : "",
    sellingPrice: String(r.sellingPrice),
    comments: r.comments ?? "",
    lineOrder: r.lineOrder,
  };
}

function parseOptionalQtyField(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const q = parseQty(t);
  return q === null ? null : roundQty(q);
}

function parseNonNegQtyField(s: string, fallback: number): number {
  const t = s.trim();
  if (t === "") return fallback;
  const q = parseQty(t);
  return q === null ? fallback : roundQty(q);
}

function parsePrice(s: string): number {
  const t = s.trim();
  if (t === "") return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function computePreview(r: LocalRow) {
  const opening = parseNonNegQtyField(r.opening, 0);
  const added = parseNonNegQtyField(r.added, 0);
  const total = roundQty(opening + added);
  const closing = parseOptionalQtyField(r.closing);
  const closingN = closing ?? 0;
  let closingError: string | undefined;
  if (closing != null && closing > total) {
    closingError = "Cannot exceed total stock";
  }
  const unitsSold = roundQty(Math.max(0, total - closingN));
  const price = parsePrice(r.sellingPrice);
  const amount = Math.round(unitsSold * price * 100) / 100;
  const system = parseOptionalQtyField(r.system);
  const variance =
    closing != null && system != null ? roundQty(closing - system) : null;
  return { total, unitsSold, amount, variance, closingError };
}

function buildSaveRow(r: LocalRow, index: number): ManualStockCountLineSaveRequest {
  const openingTrim = r.opening.trim();
  const openingQty = openingTrim === "" ? null : parseNonNegQtyField(openingTrim, 0);
  return {
    itemId: r.itemId,
    itemName: r.itemName.trim() || "—",
    sku: r.sku.trim() || null,
    openingQty,
    addedQty: parseNonNegQtyField(r.added, 0),
    addedTodayQty: 0,
    closingQty: parseOptionalQtyField(r.closing),
    systemQty: parseOptionalQtyField(r.system),
    sellingPrice: parsePrice(r.sellingPrice),
    comments: r.comments.trim() || null,
    lineOrder: index,
  };
}

export function ManualStockCountSheetPage() {
  const location = useLocation();
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId) ?? "";
  const branchId = useAppSelector(selectBranchId) ?? "";
  const branchName = useAppSelector(selectBranchName);
  const queryClient = useQueryClient();
  const toast = useToast();

  const fallbackTo = location.pathname.startsWith("/admin") ? "/admin" : "/operator";
  const [dateStr, setDateStr] = useState<string>(
    () => getSavedStockCountDate(orgId, branchId) || todayStr()
  );

  const isToday = dateStr === todayStr();

  const changeDate = useCallback((newDate: string) => {
    setDateStr(newDate);
    saveStockCountDate(newDate, orgId, branchId);
  }, [orgId, branchId]);

  useEffect(() => {
    if (!orgId || !branchId) return;
    const saved = getSavedStockCountDate(orgId, branchId);
    if (saved && saved !== dateStr) {
      setDateStr(saved);
    }
  }, [orgId, branchId]);
  const [localRows, setLocalRows] = useState<LocalRow[]>([]);
  const [hydratedForDate, setHydratedForDate] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [addModal, setAddModal] = useState<"catalog" | "custom" | null>(null);
  const [catalogItemId, setCatalogItemId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSku, setCustomSku] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LocalRow | null>(null);

  const { data: sheet, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["manual-stock-count", token, orgId, branchId, dateStr],
    queryFn: () => fetchManualStockCountSheet(token, orgId, branchId, dateStr),
    enabled: Boolean(token && orgId && branchId),
    staleTime: 0,
  });

  const { data: catalogItems = [] } = useQuery({
    queryKey: ["manual-stock-count-items", token, orgId],
    queryFn: () => fetchAllOrgItems(token, orgId),
    enabled: Boolean(token && orgId && addModal === "catalog"),
  });

  useEffect(() => {
    setHydratedForDate(null);
    setLocalRows([]);
    setPage(0);
  }, [dateStr]);

  useEffect(() => {
    if (!sheet || sheet.date !== dateStr) return;
    if (hydratedForDate === dateStr) return;
    setLocalRows(sheet.rows.map(serverRowToLocal));
    setHydratedForDate(dateStr);
  }, [sheet, dateStr, hydratedForDate]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveManualStockCountSheet(token, orgId, branchId, {
        date: dateStr,
        outletId: branchId,
        rows: localRows.map((r, i) => buildSaveRow(r, i)),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["manual-stock-count", token, orgId, branchId, dateStr],
        data
      );
      setLocalRows(data.rows.map(serverRowToLocal));
      setHydratedForDate(dateStr);
      toast.success("Stock count sheet saved.", { title: "Saved" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const itemOptions = useMemo(
    () =>
      catalogItems.map((it: Item) => ({
        value: it.id,
        label: it.name,
        detail: it.sku ?? undefined,
      })),
    [catalogItems]
  );

  const {
    searchQuery,
    setSearchQuery,
    filteredRows: paginatedRows,
    allFilteredRows: filteredRows,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(localRows, undefined, {
    page,
    size: pageSize,
    setPage,
    sortAccessors: MANUAL_STOCK_SORT,
  });

  const showVarCol = useMemo(
    () => paginatedRows.some((r) => computePreview(r).variance != null),
    [paginatedRows]
  );
  const manualVisibleColCount = 12 + (showVarCol ? 1 : 0);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / pageSize) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [filteredRows.length, pageSize]);

  const hasErrors = useMemo(
    () => filteredRows.some((r) => computePreview(r).closingError),
    [filteredRows]
  );

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        const p = computePreview(r);
        return { unitsSold: acc.unitsSold + p.unitsSold, amount: acc.amount + p.amount };
      },
      { unitsSold: 0, amount: 0 }
    );
  }, [filteredRows]);

  const addFromCatalog = useCallback(() => {
    if (!catalogItemId) {
      toast.error("Select an item.");
      return;
    }
    const it = catalogItems.find((x: Item) => x.id === catalogItemId);
    if (!it) {
      toast.error("Item not found.");
      return;
    }
    const row: LocalRow = {
      clientId: generateUuid(),
      serverId: null,
      itemId: it.id,
      itemName: it.name,
      sku: it.sku ?? "",
      opening: "",
      added: "0",
      closing: "",
      system: "",
      sellingPrice: it.defaultSellingPrice != null ? String(it.defaultSellingPrice) : "0",
      comments: "",
      lineOrder: localRows.length,
    };
    setLocalRows((prev) => [...prev, row]);
    setAddModal(null);
    setCatalogItemId("");
    toast.success("Row added. Leave Opening blank to use yesterday’s closing on save.", {
      title: "Line",
    });
  }, [catalogItemId, catalogItems, localRows.length, toast]);

  const addCustom = useCallback(() => {
    const name = customName.trim();
    if (!name) {
      toast.error("Enter a product name.");
      return;
    }
    const row: LocalRow = {
      clientId: generateUuid(),
      serverId: null,
      itemId: null,
      itemName: name,
      sku: customSku.trim(),
      opening: "",
      added: "0",
      closing: "",
      system: "",
      sellingPrice: "0",
      comments: "",
      lineOrder: localRows.length,
    };
    setLocalRows((prev) => [...prev, row]);
    setAddModal(null);
    setCustomName("");
    setCustomSku("");
    toast.success("Row added.", { title: "Line" });
  }, [customName, customSku, localRows.length, toast]);

  function updateRow(clientId: string, patch: Partial<LocalRow>) {
    setLocalRows((prev) =>
      prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r))
    );
  }

  function handleQtyField(
    clientId: string,
    key: keyof Pick<LocalRow, "opening" | "added" | "closing" | "system">,
    value: string
  ) {
    if (isValidQtyInput(value)) {
      updateRow(clientId, { [key]: value } as Partial<LocalRow>);
    }
  }

  function handlePriceField(clientId: string, value: string) {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      updateRow(clientId, { sellingPrice: value });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setLocalRows((prev) => prev.filter((r) => r.clientId !== deleteTarget.clientId));
    setDeleteTarget(null);
  }

  if (!orgId || !branchId) {
    return (
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-400">
          Select organization and branch to use the manual stock count sheet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
      <PageHeader
        title="Stock Count Sheet"
        subtitle={`Manual sheet at ${branchName ?? "this branch"} (no ledger). Same layout as standard count: Opening + Added = Total stock; Closing and System are typed in; Units sold = Total − Closing; Variance = Closing − System; Amount = Units sold × selling price. Item name is set when you add a row. Leave Opening blank on save to use yesterday’s saved closing.`}
        subtitleRevealOnTitleHover
        icon={FileSpreadsheet}
        fallbackTo={fallbackTo}
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search all columns…" />
          {sheet?.lastSavedAt && (
            <span className="hidden shrink-0 text-xs text-slate-500 md:inline dark:text-slate-400">
              Saved: {formatDateTime(sheet.lastSavedAt)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
          <button
            type="button"
            onClick={() => setAddModal("catalog")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:px-3 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Add from</span> catalog
          </button>
          <button
            type="button"
            onClick={() => setAddModal("custom")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:px-3 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Custom
          </button>
          <button
            type="button"
            onClick={() => changeDate(toDateStr(new Date(parseDateStr(dateStr).getTime() - 86400000)))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <DatePicker
            selected={parseDateStr(dateStr)}
            onChange={(d: Date | null) => changeDate(d ? toDateStr(d) : todayStr())}
            maxDate={new Date()}
            dateFormat="dd/MM/yyyy"
            className="w-[6.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm sm:w-32 sm:px-3 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button"
            onClick={() => changeDate(toDateStr(new Date(parseDateStr(dateStr).getTime() + 86400000)))}
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
          <button
            type="button"
            onClick={() => {
              if (hasErrors) {
                toast.error("Fix validation errors before saving.");
                return;
              }
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending || localRows.length === 0 || hasErrors}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {getApiErrorMessage(error)}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">
            ← swipe table to see all columns →
          </p>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "750px" }}>
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
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="open"
                      label="Open"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="added"
                      label="Added"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="total"
                      label="Total"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="close"
                      label="Close"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="sys"
                      label="Sys"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    {showVarCol && (
                      <SortableTableHead
                      align="right"
                        columnKey="var"
                        label="Var"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
                    <SortableTableHead
                      align="right"
                      columnKey="sold"
                      label="Sold"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="price"
                      label="Price"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      align="right"
                      columnKey="amount"
                      label="Amt"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <th className={tableHeadCell}>
                      Notes
                    </th>
                    <th
                      className={`${tableHeadCell} w-10 px-1 text-center sm:w-12 sm:px-2`}
                      aria-label="Row actions"
                    >
                      {" "}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={manualVisibleColCount}
                        className={tableEmptyCell}
                      >
                        No lines yet. Add from catalog or a custom line, then save.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((r, index) => {
                      const p = computePreview(r);
                      const inputBase =
                        "w-12 rounded border px-1 py-0.5 text-right text-xs tabular-nums text-slate-900 sm:w-16 sm:px-2 sm:py-1 sm:text-sm dark:text-white";
                      return (
                        <tr
                          key={r.clientId}
                          className={tableBodyRow}
                        >
                    <TableRowNumberCell page={page} pageSize={pageSize} indexInPage={index} />
                          <td className={tableStickyFirstBody}>
                            <div>{r.itemName || "—"}</div>
                            {r.sku ? (
                              <div className="text-[10px] font-normal text-slate-500 sm:text-xs dark:text-slate-400">
                                {r.sku}
                              </div>
                            ) : null}
                          </td>
                          <td className={tableBodyCell}>
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.opening}
                                onChange={(e) =>
                                  handleQtyField(r.clientId, "opening", e.target.value)
                                }
                                title="Leave blank on save to carry yesterday’s closing"
                                className={`${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          <td className={tableBodyCell}>
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.added}
                                onChange={(e) =>
                                  handleQtyField(r.clientId, "added", e.target.value)
                                }
                                className={`${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          <td className={tableBodyCellNum}>
                            {formatQty(p.total)}
                          </td>
                          <td className={tableBodyCell}>
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.closing}
                                onChange={(e) =>
                                  handleQtyField(r.clientId, "closing", e.target.value)
                                }
                                className={`${inputBase} ${
                                  p.closingError
                                    ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/20"
                                    : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                                }`}
                              />
                              {p.closingError ? (
                                <span className="mt-0.5 max-w-[6rem] text-right text-[10px] text-red-600 sm:text-xs dark:text-red-400">
                                  {p.closingError}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className={tableBodyCell}>
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.system}
                                onChange={(e) =>
                                  handleQtyField(r.clientId, "system", e.target.value)
                                }
                                className={`${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          {showVarCol && (
                            <td
                              className={`${tableBodyCellNum} ${
                                p.variance != null && p.variance > 0
                                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                  : p.variance != null && p.variance < 0
                                    ? "font-semibold text-red-600 dark:text-red-400"
                                    : "text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {p.variance == null ? "—" : formatQtyVariance(p.variance)}
                            </td>
                          )}
                          <td className={tableBodyCellNum}>
                            {formatQty(p.unitsSold)}
                          </td>
                          <td className={tableBodyCell}>
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.sellingPrice}
                                onChange={(e) => handlePriceField(r.clientId, e.target.value)}
                                className={`min-w-[3rem] sm:min-w-[4rem] ${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          <td className={`${tableBodyCellNum} font-semibold text-slate-700 dark:text-slate-300`}>
                            {formatAmount(p.amount)}
                          </td>
                          <td className="px-4 py-2 align-top sm:px-6 sm:py-2.5">
                            <textarea
                              value={r.comments}
                              onChange={(e) => {
                                if (e.target.value.length <= 2000) {
                                  updateRow(r.clientId, { comments: e.target.value });
                                }
                              }}
                              rows={1}
                              maxLength={2000}
                              placeholder="Notes…"
                              aria-label={`comments for ${r.itemName}`}
                              className="w-full min-w-[5rem] max-w-[18rem] resize-y rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:min-w-[8rem] sm:px-2 sm:py-1 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                            />
                          </td>
                          <td className="px-1 py-2 align-top text-center sm:px-2 sm:py-2.5">
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(r)}
                              className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              </div>
              {filteredRows.length > 0 && (
                <Pagination
                  page={page}
                  size={pageSize}
                  totalElements={filteredRows.length}
                  onPageChange={setPage}
                  onSizeChange={(s) => {
                    setPageSize(s);
                    setPage(0);
                  }}
                  sizeOptions={[10, 25, 50, 100]}
                  onRefresh={() => void refetch()}
                  isRefreshing={isFetching}
                />
              )}
            </div>

          {totals.amount > 0 && (
            <div className="mt-4 flex justify-end">
              <StatChip
                label="Total Sales"
                value={formatCurrency(totals.amount)}
                tone="sales"
              />
            </div>
          )}
        </>
      )}

      {addModal === "catalog" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-slate-950/60">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              Add from catalog
            </h3>
            <SearchableSelect
              options={itemOptions}
              value={catalogItemId}
              onChange={setCatalogItemId}
              placeholder="Search item…"
              className="mb-4 w-full"
            />
            <div className="flex flex-row flex-nowrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={addFromCatalog}
                className="rounded-lg bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary-500 shrink-0"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddModal(null);
                  setCatalogItemId("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {addModal === "custom" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-slate-950/60">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              Custom line
            </h3>
            <label className="mb-2 block text-sm text-slate-600 dark:text-slate-300">
              Name
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <label className="mb-4 block text-sm text-slate-600 dark:text-slate-300">
              SKU
              <input
                type="text"
                value={customSku}
                onChange={(e) => setCustomSku(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <div className="flex flex-row flex-nowrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={addCustom}
                className="rounded-lg bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary-500 shrink-0"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddModal(null);
                  setCustomName("");
                  setCustomSku("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Remove line"
        message="Remove this row from the sheet? Unsaved changes on other rows stay in the table until you save."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
