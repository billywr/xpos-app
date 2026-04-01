import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatCurrency } from "@/utils/formatCurrency";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { generateUuid } from "@/utils/uuid";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  Search,
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

function serverRowToLocal(r: import("@/api/manualStockCount").ManualStockCountLineResponse): LocalRow {
  const combinedAdded = r.addedQty + r.addedTodayQty;
  return {
    clientId: r.id,
    serverId: r.id,
    itemId: r.itemId,
    itemName: r.itemName,
    sku: r.sku ?? "",
    opening: String(r.openingQty),
    added: String(combinedAdded),
    closing: r.closingQty != null ? String(r.closingQty) : "",
    system: r.systemQty != null ? String(r.systemQty) : "",
    sellingPrice: String(r.sellingPrice),
    comments: r.comments ?? "",
    lineOrder: r.lineOrder,
  };
}

function parseOptionalNonNegInt(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function parseNonNegInt(s: string, fallback: number): number {
  const t = s.trim();
  if (t === "") return fallback;
  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

function parsePrice(s: string): number {
  const t = s.trim();
  if (t === "") return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function computePreview(r: LocalRow) {
  const opening = parseNonNegInt(r.opening, 0);
  const added = parseNonNegInt(r.added, 0);
  const total = opening + added;
  const closing = parseOptionalNonNegInt(r.closing);
  const closingN = closing ?? 0;
  let closingError: string | undefined;
  if (closing != null && closing > total) {
    closingError = "Cannot exceed total stock";
  }
  const unitsSold = Math.max(0, total - closingN);
  const price = parsePrice(r.sellingPrice);
  const amount = Math.round(unitsSold * price * 100) / 100;
  const system = parseOptionalNonNegInt(r.system);
  const variance =
    closing != null && system != null ? closing - system : null;
  return { total, unitsSold, amount, variance, closingError };
}

function buildSaveRow(r: LocalRow, index: number): ManualStockCountLineSaveRequest {
  const openingTrim = r.opening.trim();
  const openingQty =
    openingTrim === "" ? null : Math.max(0, parseInt(openingTrim, 10) || 0);
  return {
    itemId: r.itemId,
    itemName: r.itemName.trim() || "—",
    sku: r.sku.trim() || null,
    openingQty,
    addedQty: parseNonNegInt(r.added, 0),
    addedTodayQty: 0,
    closingQty: parseOptionalNonNegInt(r.closing),
    systemQty: parseOptionalNonNegInt(r.system),
    sellingPrice: parsePrice(r.sellingPrice),
    comments: r.comments.trim() || null,
    lineOrder: index,
  };
}

export function ManualStockCountSheetPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId) ?? "";
  const branchId = useAppSelector(selectBranchId) ?? "";
  const branchName = useAppSelector(selectBranchName);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [dateStr, setDateStr] = useState(todayStr);
  const [localRows, setLocalRows] = useState<LocalRow[]>([]);
  const [hydratedForDate, setHydratedForDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [addModal, setAddModal] = useState<"catalog" | "custom" | null>(null);
  const [catalogItemId, setCatalogItemId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSku, setCustomSku] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LocalRow | null>(null);

  const { data: sheet, isLoading, isError, error } = useQuery({
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

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return localRows;
    return localRows.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q)
    );
  }, [localRows, searchQuery]);

  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

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

  function handleIntField(
    clientId: string,
    key: keyof Pick<LocalRow, "opening" | "added" | "closing" | "system">,
    value: string
  ) {
    if (value === "" || /^\d*$/.test(value)) {
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
        icon={FileSpreadsheet}
        fallbackTo="/operator"
      />

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            type="search"
            placeholder="Filter by name or SKU"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-base text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white sm:max-w-xs"
          />
          {sheet?.lastSavedAt && (
            <span className="hidden shrink-0 text-sm text-slate-500 dark:text-slate-400 sm:inline">
              Last saved: {new Date(sheet.lastSavedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAddModal("catalog")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            Add from catalog
          </button>
          <button
            type="button"
            onClick={() => setAddModal("custom")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            Custom line
          </button>
          <button
            type="button"
            onClick={() => setDateStr(toDateStr(new Date(parseDateStr(dateStr).getTime() - 86400000)))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <DatePicker
            selected={parseDateStr(dateStr)}
            onChange={(d: Date | null) => setDateStr(d ? toDateStr(d) : todayStr())}
            maxDate={new Date()}
            dateFormat="dd/MM/yyyy"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button"
            onClick={() => setDateStr(toDateStr(new Date(parseDateStr(dateStr).getTime() + 86400000)))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Next day"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
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
          <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="max-h-[55vh] min-h-0 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-base font-medium text-slate-700 dark:text-slate-300">
                      Item
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Opening
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Added
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Total Stock
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Closing
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      System
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Variance
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Units Sold
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Selling Price
                    </th>
                    <th className="px-4 py-3 text-right text-base font-medium text-slate-700 dark:text-slate-300">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-base font-medium text-slate-700 dark:text-slate-300">
                      comments
                    </th>
                    <th
                      className="w-12 px-2 py-3 text-center text-base font-medium text-slate-700 dark:text-slate-300"
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
                        colSpan={12}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No lines yet. Add from catalog or a custom line, then save.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((r) => {
                      const p = computePreview(r);
                      const inputBase =
                        "w-20 rounded border px-2 py-1 text-right text-base tabular-nums text-slate-900 dark:text-white";
                      return (
                        <tr
                          key={r.clientId}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        >
                          <td className="px-4 py-2 text-base font-bold text-slate-900 dark:text-white">
                            <div>{r.itemName || "—"}</div>
                            {r.sku ? (
                              <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                {r.sku}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={r.opening}
                                onChange={(e) =>
                                  handleIntField(r.clientId, "opening", e.target.value)
                                }
                                title="Leave blank on save to carry yesterday’s closing"
                                className={`${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={r.added}
                                onChange={(e) =>
                                  handleIntField(r.clientId, "added", e.target.value)
                                }
                                className={`${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-base tabular-nums text-slate-700 dark:text-slate-300">
                            {p.total}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={r.closing}
                                onChange={(e) =>
                                  handleIntField(r.clientId, "closing", e.target.value)
                                }
                                className={`${inputBase} ${
                                  p.closingError
                                    ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/20"
                                    : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                                }`}
                              />
                              {p.closingError ? (
                                <span className="mt-0.5 max-w-[8rem] text-right text-xs text-red-600 dark:text-red-400">
                                  {p.closingError}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={r.system}
                                onChange={(e) =>
                                  handleIntField(r.clientId, "system", e.target.value)
                                }
                                className={`${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          <td
                            className={`px-4 py-2 text-right text-base tabular-nums ${
                              p.variance != null && p.variance > 0
                                ? "font-medium text-emerald-600 dark:text-emerald-400"
                                : p.variance != null && p.variance < 0
                                  ? "font-medium text-red-600 dark:text-red-400"
                                  : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {p.variance == null ? (
                              "—"
                            ) : (
                              <>
                                {p.variance > 0 ? "+" : ""}
                                {p.variance}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-base tabular-nums text-slate-700 dark:text-slate-300">
                            {p.unitsSold}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-col items-end">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.sellingPrice}
                                onChange={(e) => handlePriceField(r.clientId, e.target.value)}
                                className={`min-w-[5rem] ${inputBase} border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800`}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-base font-medium tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-4 py-2 align-top">
                            <textarea
                              value={r.comments}
                              onChange={(e) => {
                                if (e.target.value.length <= 2000) {
                                  updateRow(r.clientId, { comments: e.target.value });
                                }
                              }}
                              rows={2}
                              maxLength={2000}
                              placeholder="Notes…"
                              aria-label={`comments for ${r.itemName}`}
                              className="min-w-[10rem] max-w-[18rem] resize-y rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                            />
                          </td>
                          <td className="px-2 py-2 align-top text-center">
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
              />
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <div
              className="total-sales-badge inline-flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-6 py-4 shadow-lg ring-2 ring-emerald-100/50 dark:border-emerald-800 dark:from-emerald-950/50 dark:to-teal-950/50 dark:ring-emerald-900/30"
              role="status"
            >
              <span className="text-base font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Total Sales
              </span>
              <span className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                {formatCurrency(totals.amount)}
              </span>
            </div>
          </div>
        </>
      )}

      {addModal === "catalog" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddModal(null);
                  setCatalogItemId("");
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addFromCatalog}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {addModal === "custom" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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
              SKU (optional)
              <input
                type="text"
                value={customSku}
                onChange={(e) => setCustomSku(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddModal(null);
                  setCustomName("");
                  setCustomSku("");
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addCustom}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Add
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
