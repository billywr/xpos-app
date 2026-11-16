import { useState, useEffect, useMemo, useCallback } from "react";
import { useDataTable } from "@/hooks/useDataTable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchSuppliers } from "@/api/suppliers";
import { fetchItems, fetchItemByBarcode, fetchAllOrgItems } from "@/api/items";
import {
  fetchGoodsReceiptNotes,
  createGoodsReceiptNote,
  updateGoodsReceiptNote,
  deleteGoodsReceiptNotePermanently,
  type GrnLineRequest,
  type GrnLineResponse,
  type GoodsReceiptNoteResponse,
} from "@/api/goodsReceiptNotes";
import type { Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import type { Item } from "@/types/catalog";
import type { Supplier } from "@/api/suppliers";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  SlideOver,
  Pagination,
  ConfirmDialog,
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
  tableBodyCellNumDebts,
  tableCard,
  StatChip,
  DateInput,
} from "@/components/ui";
import { cn } from "@/utils/cn";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatCurrency, formatAmount } from "@/utils/formatCurrency";
import { formatQty } from "@/utils/formatQuantity";
import { useToast } from "@/contexts/ToastContext";
import { invalidateInventoryQueries } from "@/utils/invalidateInventoryQueries";
import { downloadItemsPdf } from "@/utils/itemsPdf";
import { filterRowsBySearch } from "@/utils/tableSearchMatch";
import { Link } from "react-router-dom";
import { Plus, PackagePlus, Trash2, Pencil, FileEdit, FileX, RotateCcw, Download, Loader2 } from "lucide-react";
import { BarcodeCaptureInput } from "@/components/BarcodeCaptureInput";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import {
  BARCODE_GOODS_RECEIPT,
  isBarcodeVisible,
} from "@/config/barcodeVisibility";
import { ItemSearchCombobox } from "@/components/ItemSearchCombobox";
import { SearchableSelect } from "@/components/SearchableSelect";
import { isSameLocalCalendarDay } from "@/utils/calendarDay";
import {
  getSavedGoodsReceiptReceivedAt,
  saveGoodsReceiptReceivedAt,
  getSavedGoodsReceiptFilterRange,
  saveGoodsReceiptFilterRange,
} from "@/utils/datePersistenceStorage";

const DEFAULT_PAGE_SIZE = 15;
const GRN_FETCH_PAGE_SIZE = 500;
/** Recent active receipts while slide-over is open (to hide items already received today elsewhere). */
const GRN_RECEIVE_CONTEXT_PAGE_SIZE = 400;

type GrnFlattenedRow = {
  grn: GoodsReceiptNoteResponse;
  line: GrnLineResponse | null;
  isFirstLineOfReceipt: boolean;
};

function grnFlattenedRowSearchText(row: GrnFlattenedRow): string {
  const parts: string[] = [row.grn.supplierName ?? "", row.grn.receivedAt ?? ""];
  if (row.grn.receivedAt) {
    try {
      parts.push(new Date(row.grn.receivedAt).toLocaleString());
    } catch {
      // ignore invalid dates in search haystack
    }
  }
  if (row.line) {
    parts.push(
      row.line.itemName ?? "",
      row.line.barcode ?? "",
      String(row.line.qty),
      row.line.receivedUnitCost != null ? String(row.line.receivedUnitCost) : ""
    );
  }
  return parts.join(" ");
}

const GRN_SORT = {
  received: (row: GrnFlattenedRow) => row.grn.receivedAt,
  name: (row: GrnFlattenedRow) => row.line?.itemName ?? "",
  barcode: (row: GrnFlattenedRow) => row.line?.barcode ?? "",
  qty: (row: GrnFlattenedRow) => row.line?.qty ?? 0,
  buyPrice: (row: GrnFlattenedRow) => row.line?.receivedUnitCost ?? 0,
  total: (row: GrnFlattenedRow) =>
    row.line ? row.line.qty * (row.line.receivedUnitCost ?? 0) : 0,
};

function formatDateInput(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse date field value; returns null if empty/invalid. */
function parseDateInputToDate(dateInputVal: string): Date | null {
  const s = dateInputVal.trim();
  if (!s) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convert date picker value (YYYY-MM-DD) to ISO-8601 for API (Instant expects seconds + timezone). */
function toISOReceivedAt(dateInputVal: string): string {
  const s = dateInputVal.trim();
  if (!s) {
    return s;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const today = formatDateInput(new Date());
    if (s === today) {
      return new Date().toISOString();
    }
    return new Date(`${s}T12:00:00Z`).toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    return new Date(s + ":00").toISOString();
  }
  return new Date(s).toISOString();
}

export type DatePreset =
  | "all"
  | "today"
  | "7days"
  | "30days"
  | "thisMonth"
  | "custom";

export const PRESET_OPTIONS: Array<{ key: DatePreset; label: string }> = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "30days", label: "30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "custom", label: "Custom" },
];

function formatLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isReceiptInDateRange(
  receivedAtIso: string,
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date()
): boolean {
  if (preset === "all") return true;

  const date = new Date(receivedAtIso);
  if (Number.isNaN(date.getTime())) return false;

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  if (preset === "today") {
    return date >= todayStart && date <= todayEnd;
  }

  if (preset === "7days") {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0
    );
    return date >= start && date <= todayEnd;
  }

  if (preset === "30days") {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 29,
      0,
      0,
      0,
      0
    );
    return date >= start && date <= todayEnd;
  }

  if (preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    return date >= start && date <= end;
  }

  if (preset === "custom") {
    if (customStart) {
      const [y, m, d] = customStart.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        if (date < start) return false;
      }
    }
    if (customEnd) {
      const [y, m, d] = customEnd.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        if (date > end) return false;
      }
    }
    return true;
  }

  return true;
}

function grnLineResponseToRequest(line: GrnLineResponse): GrnLineRequest {
  return {
    itemId: line.itemId,
    qty: line.qty,
    receivedUnitCost: line.receivedUnitCost,
  };
}

interface GrnLineForm {
  itemId: string;
  itemName: string;
  qty: string;
  receivedUnitCost: string;
}

export interface GoodsReceiptPageProps {
  initialOrgId?: string;
  initialBranchId?: string;
}

export function GoodsReceiptPage({
  initialOrgId,
  initialBranchId,
}: GoodsReceiptPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const navContext = useNavVisibilityContextOrNull();
  const showBarcode = isBarcodeVisible(
    navContext?.adminVisibility ?? {},
    BARCODE_GOODS_RECEIPT
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId ?? "");
  const [activePreset, setActivePreset] = useState<DatePreset>(() => {
    const saved = getSavedGoodsReceiptFilterRange(initialOrgId, initialBranchId);
    return (saved.preset as DatePreset) || "all";
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const saved = getSavedGoodsReceiptFilterRange(initialOrgId, initialBranchId);
    return saved.startDate || "";
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const saved = getSavedGoodsReceiptFilterRange(initialOrgId, initialBranchId);
    return saved.endDate || "";
  });

  useEffect(() => {
    if (!selectedOrgId || !selectedBranchId) return;
    const saved = getSavedGoodsReceiptFilterRange(selectedOrgId, selectedBranchId);
    if (saved.preset) {
      setActivePreset(saved.preset as DatePreset);
      if (saved.startDate) setCustomStartDate(saved.startDate);
      if (saved.endDate) setCustomEndDate(saved.endDate);
    }
  }, [selectedOrgId, selectedBranchId]);

  const [filterSupplierId, setFilterSupplierId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingGrn, setEditingGrn] = useState<GoodsReceiptNoteResponse | null>(null);
  /** When set, slide-over edits only this line; save merges with other lines on the receipt. */
  const [editingSingleLineId, setEditingSingleLineId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string>("");
  const [receivedAt, setReceivedAt] = useState<string>(
    () => getSavedGoodsReceiptReceivedAt(initialOrgId, initialBranchId) || ""
  );
  const [lines, setLines] = useState<GrnLineForm[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDeleteReceipt, setConfirmDeleteReceipt] =
    useState<GoodsReceiptNoteResponse | null>(null);
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<{
    grn: GoodsReceiptNoteResponse;
    line: GrnLineResponse;
  } | null>(null);
  const [permanentDeleteLoading, setPermanentDeleteLoading] = useState(false);
  const [barcodeScanMessage, setBarcodeScanMessage] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);
  const [scannedItems, setScannedItems] = useState<Item[]>([]);
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

  const { data: suppliersData } = useQuery({
    queryKey: ["admin-suppliers", token, selectedOrgId],
    queryFn: () => fetchSuppliers(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: itemsData } = useQuery({
    queryKey: ["admin-items", token, selectedOrgId],
    queryFn: () => fetchItems(token, selectedOrgId, { size: 500 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const { data: grnsReceiveContextData } = useQuery({
    queryKey: [
      "admin-grns-receive-context",
      token,
      selectedOrgId,
      selectedBranchId,
    ],
    queryFn: () =>
      fetchGoodsReceiptNotes(token, selectedOrgId, selectedBranchId, {
        page: 0,
        size: GRN_RECEIVE_CONTEXT_PAGE_SIZE,
        includeInactive: false,
      }),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId) &&
      slideOpen,
  });

  const { data: grnsData, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "admin-grns",
      token,
      selectedOrgId,
      selectedBranchId,
    ],
    queryFn: () =>
      fetchGoodsReceiptNotes(token, selectedOrgId, selectedBranchId, {
        page: 0,
        size: GRN_FETCH_PAGE_SIZE,
        includeInactive: false,
      }),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedBranchId),
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      branchId: string;
      supplierId: string;
      receivedAt?: string | null;
      lines: GrnLineRequest[];
    }) => createGoodsReceiptNote(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-grns", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "admin-grns-receive-context",
          token,
          selectedOrgId,
          selectedBranchId,
        ],
      });
      void invalidateInventoryQueries(queryClient);
      setSlideOpen(false);
      setEditingGrn(null);
      setEditingSingleLineId(null);
      setSupplierId("");
      setLines([]);
      setFormError(null);
      setSubmitLoading(false);
      toast.success("Stock received. Inventory updated.", { title: "Received" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: {
      grnId: string;
      supplierId: string;
      receivedAt: string;
      lines?: Array<{ itemId: string; qty: number; receivedUnitCost?: number | null }>;
    }) =>
      updateGoodsReceiptNote(token, selectedOrgId, body.grnId, {
        supplierId: body.supplierId,
        receivedAt: body.receivedAt,
        lines: body.lines,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-grns", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "admin-grns-receive-context",
          token,
          selectedOrgId,
          selectedBranchId,
        ],
      });
      if (variables.lines != null) {
        void invalidateInventoryQueries(queryClient);
      }
      setSlideOpen(false);
      setEditingGrn(null);
      setEditingSingleLineId(null);
      setConfirmDeleteLine(null);
      setFormError(null);
      setSubmitLoading(false);
      toast.success("Stock receipt updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (grnId: string) =>
      deleteGoodsReceiptNotePermanently(token, selectedOrgId, grnId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-grns", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "admin-grns-receive-context",
          token,
          selectedOrgId,
          selectedBranchId,
        ],
      });
      void invalidateInventoryQueries(queryClient);
      setConfirmDeleteReceipt(null);
      setPermanentDeleteLoading(false);
      toast.success(
        "Receipt and its stock movements were removed. Inventory was adjusted.",
        { title: "Receipt deleted" }
      );
    },
    onError: (err) => {
      setPermanentDeleteLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const suppliers = suppliersData?.content ?? [];

  const items = useMemo(() => {
    const fromApi = (itemsData?.content ?? []) as Item[];
    const seen = new Set(fromApi.map((i: Item) => i.id));
    const extra = scannedItems.filter((s) => !seen.has(s.id));
    return [...fromApi, ...extra];
  }, [itemsData?.content, scannedItems]);

  /**
   * Calendar day used for “one item per branch per day across receipts” rule.
   * Dynamically resolves from the form "Received at" date for both new receipts and edits,
   * falling back to the original receipt time or now.
   */
  const grnDuplicateRuleReferenceDate = useMemo((): Date => {
    const parsed = parseDateInputToDate(receivedAt);
    if (parsed) {
      return parsed;
    }
    if (editingGrn?.receivedAt) {
      const parsedGrnDate = parseDateInputToDate(editingGrn.receivedAt);
      if (parsedGrnDate) {
        return parsedGrnDate;
      }
      return new Date(editingGrn.receivedAt);
    }
    return new Date();
  }, [editingGrn?.receivedAt, receivedAt]);

  /**
   * Items on another active receipt for the same supplier, same local calendar day as this draft's receivedAt
   * (excludes the receipt being edited). Different suppliers may GRN the same item the same day.
   */
  const itemIdsReceivedOnSelectedDateOtherGrns = useMemo(() => {
    const ids = new Set<string>();
    const currentGrnId = editingGrn?.id ?? null;
    const ruleSupplierId = (supplierId.trim() || editingGrn?.supplierId || "").trim();
    for (const grn of grnsReceiveContextData?.content ?? []) {
      if (!grn.active) {
        continue;
      }
      if (ruleSupplierId && grn.supplierId !== ruleSupplierId) {
        continue;
      }
      if (!isSameLocalCalendarDay(grn.receivedAt, grnDuplicateRuleReferenceDate)) {
        continue;
      }
      if (currentGrnId != null && String(grn.id) === String(currentGrnId)) {
        continue;
      }
      for (const line of grn.lines) {
        ids.add(line.itemId);
      }
    }
    return ids;
  }, [
    grnsReceiveContextData?.content,
    editingGrn?.id,
    editingGrn?.supplierId,
    grnDuplicateRuleReferenceDate,
    supplierId,
  ]);

  /** Item IDs already on the GRN being edited (snapshot from server). Used to allow saves when another receipt shares the same day+supplier. */
  const originalGrnItemIds = useMemo(() => {
    if (!editingGrn) {
      return new Set<string>();
    }
    return new Set(editingGrn.lines.map((line) => line.itemId));
  }, [editingGrn?.id, editingGrn?.lines]);

  const grns = grnsData?.content ?? [];

  const filteredGrns = useMemo(() => {
    return grns.filter((grn) => {
      if (filterSupplierId && grn.supplierId !== filterSupplierId) {
        return false;
      }
      return isReceiptInDateRange(
        grn.receivedAt,
        activePreset,
        customStartDate,
        customEndDate
      );
    });
  }, [grns, filterSupplierId, activePreset, customStartDate, customEndDate]);

  /** Flattened rows: one entry per receipt line (or one placeholder per empty receipt). */
  const allRows = useMemo(() => {
    const rows: GrnFlattenedRow[] = [];
    for (const grn of filteredGrns) {
      if (grn.lines.length === 0) {
        rows.push({ grn, line: null, isFirstLineOfReceipt: true });
      } else {
        grn.lines.forEach((line, idx) => {
          rows.push({ grn, line, isFirstLineOfReceipt: idx === 0 });
        });
      }
    }
    return rows;
  }, [filteredGrns]);

  const {
    searchQuery,
    setSearchQuery,
    filteredRows: pagedRows,
    totalElements,
    allFilteredRows,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(allRows, undefined, {
    page,
    size,
    setPage,
    getSearchableText: grnFlattenedRowSearchText,
    sortAccessors: GRN_SORT,
  });

  const supplierFilterOptions = useMemo(
    () => [
      { value: "", label: "All suppliers" },
      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliers]
  );

  const isFilterActive =
    activePreset !== "all" ||
    Boolean(filterSupplierId) ||
    searchQuery.trim().length > 0;

  const handleSelectPreset = (p: DatePreset) => {
    setActivePreset(p);
    setPage(0);
    let sDate = customStartDate;
    let eDate = customEndDate;
    if (p === "custom") {
      if (!sDate || !eDate) {
        const now = new Date();
        const past30 = new Date(now);
        past30.setDate(past30.getDate() - 29);
        if (!sDate) {
          sDate = formatLocalDate(past30);
          setCustomStartDate(sDate);
        }
        if (!eDate) {
          eDate = formatLocalDate(now);
          setCustomEndDate(eDate);
        }
      }
    }
    saveGoodsReceiptFilterRange(
      { preset: p, startDate: sDate, endDate: eDate },
      selectedOrgId,
      selectedBranchId
    );
  };

  const handleCustomStartDateChange = (val: string) => {
    setCustomStartDate(val);
    setPage(0);
    let eDate = customEndDate;
    if (eDate && val > eDate) {
      eDate = val;
      setCustomEndDate(val);
    }
    saveGoodsReceiptFilterRange(
      { preset: activePreset, startDate: val, endDate: eDate },
      selectedOrgId,
      selectedBranchId
    );
  };

  const handleCustomEndDateChange = (val: string) => {
    setCustomEndDate(val);
    setPage(0);
    let sDate = customStartDate;
    if (sDate && val < sDate) {
      sDate = val;
      setCustomStartDate(val);
    }
    saveGoodsReceiptFilterRange(
      { preset: activePreset, startDate: sDate, endDate: val },
      selectedOrgId,
      selectedBranchId
    );
  };

  const handleResetFilters = () => {
    setActivePreset("all");
    setFilterSupplierId("");
    setSearchQuery("");
    setPage(0);
    saveGoodsReceiptFilterRange(
      { preset: "all", startDate: "", endDate: "" },
      selectedOrgId,
      selectedBranchId
    );
  };

  const [downloadingItemsPdf, setDownloadingItemsPdf] = useState(false);

  const handleDownloadItemsPdf = async () => {
    if (!token || !selectedOrgId) return;
    setDownloadingItemsPdf(true);
    try {
      const allItems = await fetchAllOrgItems(token, selectedOrgId);
      let exportItems = allItems.filter((i) => i.active);
      if (searchQuery.trim()) {
        exportItems = filterRowsBySearch(exportItems, searchQuery, undefined, {
          name: (i) => i.name,
          sku: (i) => i.sku ?? "",
        });
      }
      if (exportItems.length === 0) {
        toast.error("No items matching the search query to export.");
        return;
      }
      const orgName = orgs.find((o) => o.id === selectedOrgId)?.name ?? "Organization";
      const pdfOptions: {
        orgName?: string | null;
        searchQuery?: string;
      } = { orgName };
      if (searchQuery.trim()) {
        pdfOptions.searchQuery = searchQuery.trim();
      }
      downloadItemsPdf(exportItems, pdfOptions);
      toast.success("PDF downloaded.", { title: "Items list" });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloadingItemsPdf(false);
    }
  };

  /** Hide columns whose every row on this page has no meaningful value. */
  const showBarcodeCol = useMemo(
    () => pagedRows.some((r) => !!r.line?.barcode?.trim()),
    [pagedRows]
  );
  const showBuyPriceCol = useMemo(
    () => pagedRows.some((r) => r.line?.receivedUnitCost != null),
    [pagedRows]
  );
  const visibleColCount = 7 + (showBarcodeCol ? 1 : 0) + (showBuyPriceCol ? 1 : 0);

  const totalFilteredAmount = useMemo(() => {
    return allFilteredRows.reduce((sum, r) => {
      if (!r.line) return sum;
      return sum + r.line.qty * (r.line.receivedUnitCost ?? 0);
    }, 0);
  }, [allFilteredRows]);

  const totalFilteredUnits = useMemo(() => {
    return allFilteredRows.reduce((sum, r) => {
      if (!r.line) return sum;
      return sum + r.line.qty;
    }, 0);
  }, [allFilteredRows]);

  const totalFilteredReceipts = useMemo(() => {
    const uniqueReceiptIds = new Set(allFilteredRows.map((r) => r.grn.id));
    return uniqueReceiptIds.size;
  }, [allFilteredRows]);

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  useEffect(() => {
    if (initialBranchId) {
      setSelectedBranchId(initialBranchId);
    } else if (selectedOrgId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [initialBranchId, selectedOrgId, branches, selectedBranchId]);

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemId: "",
        itemName: "",
        qty: "",
               receivedUnitCost: "",
      },
    ]);
  };

  const handleUpdateLine = (idx: number, field: keyof GrnLineForm, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "itemId") {
        const item = items.find((i) => i.id === value);
        next[idx].itemName = item?.name ?? "";
        next[idx].receivedUnitCost =
          item?.buyingPrice != null ? String(item.buyingPrice) : "";
      }
      return next;
    });
  };

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!token || !selectedOrgId || !barcode.trim()) return;
      setBarcodeScanMessage(null);
      try {
        const item = await fetchItemByBarcode(token, selectedOrgId, barcode.trim());
        if (
          itemIdsReceivedOnSelectedDateOtherGrns.has(item.id) &&
          !(editingGrn && originalGrnItemIds.has(item.id))
        ) {
          setBarcodeScanMessage({
            type: "info",
            text: `"${item.name}" was already received on this date from this supplier on another receipt. Edit that receipt to change it, or use a different calendar day (or another supplier).`,
          });
          return;
        }
        let duplicate = false;
        setLines((prev) => {
          if (prev.some((l) => l.itemId === item.id)) {
            duplicate = true;
            return prev;
          }
          const emptyIdx = prev.findIndex((l) => !l.itemId);
          const idx = emptyIdx >= 0 ? emptyIdx : prev.length;
          const newLine = {
            itemId: item.id,
            itemName: item.name,
            qty: idx < prev.length ? prev[idx].qty : "1",
                       receivedUnitCost:
              item.buyingPrice != null ? String(item.buyingPrice) : "",
          };
          if (idx < prev.length) {
            const next = [...prev];
            next[idx] = newLine;
            return next;
          }
          return [...prev, newLine];
        });
        if (duplicate) {
          setBarcodeScanMessage({
            type: "info",
            text: `"${item.name}" is already on a line. Each item can only appear once per receipt.`,
          });
          return;
        }
        setScannedItems((s) =>
          s.some((i) => i.id === item.id) ? s : [...s, item]
        );
      } catch (err) {
        const msg = getApiErrorMessage(err);
        const isNotFound =
          (err as { data?: { code?: string } })?.data?.code === "ITEM_NOT_FOUND_BY_BARCODE" ||
          /not found|no item/i.test(msg);
        setBarcodeScanMessage({
          type: isNotFound ? "info" : "error",
          text: isNotFound
            ? `No item linked to barcode "${barcode.trim()}". Create the item in Catalog (Items) and add this barcode in the item's Barcode field, or select an item from the list below.`
            : msg,
        });
      }
    },
    [
      token,
      selectedOrgId,
      itemIdsReceivedOnSelectedDateOtherGrns,
      editingGrn,
      originalGrnItemIds,
    ]
  );

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!supplierId) {
      setFormError("Supplier is required");
      return;
    }
    if (editingGrn) {
      const rt = receivedAt.trim();
      if (!rt) {
        setFormError("Received at is required");
        return;
      }
      const validLines = lines.filter(
        (l) => l.itemId && l.qty && parseFloat(l.qty) > 0
      );
      if (validLines.length === 0) {
        setFormError("At least one line with item and quantity is required");
        return;
      }
      const mapFormToReq = (l: (typeof validLines)[number]): GrnLineRequest => ({
        itemId: l.itemId,
        qty: parseFloat(l.qty),

        receivedUnitCost: l.receivedUnitCost ? parseFloat(l.receivedUnitCost) : null,
      });

      let mergedForPatch: GrnLineRequest[];
      if (editingSingleLineId) {
        if (validLines.length !== 1) {
          setFormError("Edit one line at a time.");
          return;
        }
        const otherLines = editingGrn.lines
          .filter((l) => l.id !== editingSingleLineId)
          .map(grnLineResponseToRequest);
        const updated = mapFormToReq(validLines[0]);
        const seenIds = new Set<string>(otherLines.map((l) => l.itemId));
        if (seenIds.has(updated.itemId)) {
          setFormError("Another line on this receipt already uses this item.");
          return;
        }
        mergedForPatch = [...otherLines, updated];
      } else {
        const seenIds = new Set<string>();
        for (const l of validLines) {
          if (seenIds.has(l.itemId)) {
            setFormError("Each item can only appear once on this receipt.");
            return;
          }
          seenIds.add(l.itemId);
        }
        mergedForPatch = validLines.map(mapFormToReq);
      }

      for (const l of mergedForPatch) {
        if (
          itemIdsReceivedOnSelectedDateOtherGrns.has(l.itemId) &&
          !originalGrnItemIds.has(l.itemId)
        ) {
          setFormError(
            "Cannot add items that already appear on another stock receipt from this supplier at this branch with the same received date."
          );
          return;
        }
      }

      setSubmitLoading(true);
      updateMutation.mutate({
        grnId: editingGrn.id,
        supplierId,
        receivedAt: toISOReceivedAt(rt),
        lines: mergedForPatch,
      });
      return;
    }
    const validLines = lines
      .filter((l) => l.itemId && l.qty && parseFloat(l.qty) > 0)
      .map((l): GrnLineRequest => ({
        itemId: l.itemId,
        qty: parseFloat(l.qty),

        receivedUnitCost: l.receivedUnitCost
          ? parseFloat(l.receivedUnitCost)
          : null,
      }));
    if (validLines.length === 0) {
      setFormError("Add at least one line with item and quantity");
      return;
    }
    const seenCreateIds = new Set<string>();
    for (const l of validLines) {
      if (seenCreateIds.has(l.itemId)) {
        setFormError("Each item can only appear once on this receipt.");
        return;
      }
      seenCreateIds.add(l.itemId);
    }
    for (const l of validLines) {
      if (itemIdsReceivedOnSelectedDateOtherGrns.has(l.itemId)) {
        setFormError(
          "One or more items were already received on this date from this supplier on another stock receipt at this branch."
        );
        return;
      }
    }
    const rt = receivedAt.trim();
    setSubmitLoading(true);
    createMutation.mutate({
      branchId: selectedBranchId,
      supplierId,
      receivedAt: rt ? toISOReceivedAt(rt) : undefined,
      lines: validLines,
    });
  };

  const handleEdit = (grn: GoodsReceiptNoteResponse) => {
    setEditingGrn(grn);
    setEditingSingleLineId(null);
    setSupplierId(grn.supplierId);
    setReceivedAt(
      grn.receivedAt ? formatDateInput(grn.receivedAt) : formatDateInput(new Date())
    );
    setLines(
      grn.lines.length > 0
        ? grn.lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            qty: String(l.qty),
            receivedUnitCost:
              l.receivedUnitCost != null ? String(l.receivedUnitCost) : "",
          }))
        : [{ itemId: "", itemName: "", qty: "", receivedUnitCost: "" }]
    );
    setFormError(null);
    setBarcodeScanMessage(null);
    setSlideOpen(true);
  };

  const handleEditLine = (grn: GoodsReceiptNoteResponse, line: GrnLineResponse) => {
    setEditingGrn(grn);
    setEditingSingleLineId(line.id);
    setSupplierId(grn.supplierId);
    setReceivedAt(
      grn.receivedAt
        ? formatDateInput(grn.receivedAt)
        : formatDateInput(new Date())
    );
    setLines([
      {
        itemId: line.itemId,
        itemName: line.itemName,
        qty: String(line.qty),
        receivedUnitCost:
          line.receivedUnitCost != null ? String(line.receivedUnitCost) : "",
      },
    ]);
    setFormError(null);
    setBarcodeScanMessage(null);
    setSlideOpen(true);
  };

  const handleConfirmDeleteLine = () => {
    if (!confirmDeleteLine) return;
    const { grn, line } = confirmDeleteLine;
    const remaining = grn.lines
      .filter((l) => l.id !== line.id)
      .map(grnLineResponseToRequest);
    updateMutation.mutate({
      grnId: grn.id,
      supplierId: grn.supplierId,
      receivedAt: grn.receivedAt,
      lines: remaining,
    });
  };

  const handlePermanentDelete = (grn: GoodsReceiptNoteResponse) => {
    setPermanentDeleteLoading(true);
    permanentDeleteMutation.mutate(grn.id);
  };

  const selectedBranch = branches.find((b: Branch) => b.id === selectedBranchId);

  if (isError && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Stock"
          icon={PackagePlus}
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Stock"
          subtitle="Receive stock at a branch. Select branch and supplier, then add items with quantities to increase inventory."
          icon={PackagePlus}
          fallbackTo="/admin"
          noMargin
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadItemsPdf}
            disabled={downloadingItemsPdf || !selectedOrgId}
            title="Download PDF document of all items"
            className="flex items-center gap-1.5"
          >
            {downloadingItemsPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>Download items PDF</span>
          </Button>
          <button
            type="button"
            onClick={() => {
              setEditingGrn(null);
              setSlideOpen(true);
              setFormError(null);
              setSupplierId(suppliers[0]?.id ?? "");
              const savedReceivedAt = getSavedGoodsReceiptReceivedAt(
                selectedOrgId,
                selectedBranchId
              );
              setReceivedAt(
                savedReceivedAt ? formatDateInput(savedReceivedAt) : formatDateInput(new Date())
              );
              setLines([{ itemId: "", itemName: "", qty: "", receivedUnitCost: "" }]);
              setBarcodeScanMessage(null);
              setScannedItems([]);
            }}
            disabled={!selectedOrgId || !selectedBranchId || suppliers.length === 0}
            title={
              suppliers.length === 0
                ? "Add a supplier first (Suppliers page)"
                : undefined
            }
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Plus className="h-5 w-5" />
            Receive stock
          </button>
        </div>
      </div>

      {selectedOrgId && selectedBranchId && (
        <div className="mb-5 flex flex-col gap-4">
          {/* Quick Range Presets & Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quick range:
              </span>
              {PRESET_OPTIONS.map((p) => {
                const isSelected = activePreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSelectPreset(p.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      isSelected
                        ? "bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </button>
            )}
          </div>

          {/* Custom Date Range Selector (visible when activePreset === "custom") */}
          {activePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="grn-custom-start"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  From:
                </label>
                <DateInput
                  id="grn-custom-start"
                  value={customStartDate}
                  onChange={(e) => handleCustomStartDateChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="grn-custom-end"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  To:
                </label>
                <DateInput
                  id="grn-custom-end"
                  value={customEndDate}
                  onChange={(e) => handleCustomEndDateChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Search Bar & Supplier Filter Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <TableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by item, supplier, or barcode…"
              className="w-full sm:w-72"
            />
            {suppliers.length > 0 && (
              <div className="w-full sm:w-60">
                <SearchableSelect
                  id="grn-supplier-filter"
                  options={supplierFilterOptions}
                  value={filterSupplierId}
                  onChange={(val) => {
                    setFilterSupplierId(val);
                    setPage(0);
                  }}
                  placeholder="Filter by supplier…"
                  compact
                  className="w-full"
                  controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500"
                />
              </div>
            )}
          </div>

          {/* Intelligence KPI Summary Banner */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatChip
              label="Total Stock Value"
              value={formatCurrency(totalFilteredAmount)}
              tone="sales"
              className="w-full"
            />
            <StatChip
              label="Receipts"
              value={`${totalFilteredReceipts} receipt${totalFilteredReceipts === 1 ? "" : "s"}`}
              tone="neutral"
              className="w-full"
            />
            <StatChip
              label="Units Received"
              value={`${formatQty(totalFilteredUnits)} unit${totalFilteredUnits === 1 ? "" : "s"}`}
              tone="neutral"
              className="w-full"
            />
          </div>
        </div>
      )}

      {suppliers.length === 0 && selectedOrgId && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          No suppliers for this organization.{" "}
          <Link
            to="/admin/suppliers"
            className="font-medium underline hover:no-underline"
          >
            Add a supplier
          </Link>{" "}
          to receive stock.
        </div>
      )}

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view stock receipts and receive stock.
        </div>
      ) : (
        <>
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className={tableCard}>
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full table-auto divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "960px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      columnKey="received"
                      label="Received"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={`${tableStickyHeadCell} ${tableHeadCell}`}
                    />
                    <SortableTableHead
                      columnKey="name"
                      label="Name"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    {showBarcodeCol && (
                      <SortableTableHead
                        columnKey="barcode"
                        label="Barcode"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
                    <SortableTableHead
                      columnKey="qty"
                      label="Qty"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    {showBuyPriceCol && (
                      <SortableTableHead
                        columnKey="buyPrice"
                        label="Buy price (KSH)"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
                    <SortableTableHead
                      columnKey="total"
                      label="Total (KSH)"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
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
                  {isLoading && grns.length === 0 ? (
                    <TableSkeleton rows={size} columns={visibleColCount} />
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColCount}
                        className={tableEmptyCell}
                      >
                        {grns.length === 0 ? (
                          <>No stock receipts yet. Click &quot;Receive stock&quot; to add inventory.</>
                        ) : isFilterActive ? (
                          <>No stock receipts match the selected filters or search.</>
                        ) : (
                          "No results match your search."
                        )}
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map(({ grn, line, isFirstLineOfReceipt }, index) => {
                        const lineTotal =
                          line != null
                            ? line.qty * (line.receivedUnitCost ?? 0)
                            : 0;
                        const isFirstOfReceipt = isFirstLineOfReceipt;
                        return (
                          <tr
                            key={
                              line
                                ? `${grn.id}-${line.id}`
                                : `${grn.id}-no-lines`
                            }
                            className={tableBodyRow}
                          >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                            <td className={tableStickyFirstBody}>
                              {new Date(grn.receivedAt).toLocaleString()}
                            </td>
                            <td className={tableBodyCell}>
                              {line?.itemName ?? "—"}
                            </td>
                            {showBarcodeCol && (
                              <td className={`${tableBodyCell} font-mono`}>
                                {line?.barcode?.trim()
                                  ? line.barcode
                                  : "—"}
                              </td>
                            )}
                            <td className={tableBodyCellNumDebts}>
                              {line != null ? formatQty(line.qty) : "—"}
                            </td>
                            {showBuyPriceCol && (
                              <td className={tableBodyCellNumDebts}>
                                {line != null && line.receivedUnitCost != null
                                  ? formatAmount(line.receivedUnitCost)
                                  : "—"}
                              </td>
                            )}
                            <td className={`${tableBodyCellNumDebts} font-bold text-slate-700 dark:text-slate-300`}>
                              {line != null
                                ? formatAmount(lineTotal)
                                : "—"}
                            </td>
                            <td className={`${tableBodyCell} whitespace-nowrap align-middle`}>
                              <div className="flex items-center gap-1">
                                {line != null && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleEditLine(grn, line)}
                                      className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                                      title="Edit this line"
                                      aria-label={`Edit line ${line.itemName}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteLine({ grn, line })}
                                      className="rounded p-2 text-slate-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-slate-600 dark:hover:text-red-300"
                                      title="Remove this line from receipt"
                                      aria-label={`Remove line ${line.itemName}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                                {isFirstOfReceipt && (
                                  <>
                                    <span
                                      aria-hidden
                                      className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-600"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(grn)}
                                      className="rounded p-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                                      title="Edit all lines on this receipt"
                                      aria-label="Edit all lines on this receipt"
                                    >
                                      <FileEdit className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteReceipt(grn)}
                                      className="rounded p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                                      title="Delete entire receipt"
                                      aria-label="Delete entire receipt"
                                    >
                                      <FileX className="h-4 w-4" />
                                    </button>
                                  </>
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
                  sizeOptions={[10, 15, 25, 50, 100]}
                  onRefresh={() => void refetch()}
                  isRefreshing={isFetching}
                />
              )}
            </div>

          {grns.length > 0 && (
            <div
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-600 dark:bg-slate-900"
              aria-label="Total stock receipt amount summary"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {isFilterActive ? (
                    <>
                      Filtered:{" "}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {totalFilteredReceipts} receipt{totalFilteredReceipts === 1 ? "" : "s"}
                      </strong>{" "}
                      ({formatQty(totalFilteredUnits)} units)
                    </>
                  ) : (
                    <>
                      Total:{" "}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {grns.length} receipt{grns.length === 1 ? "" : "s"}
                      </strong>{" "}
                      ({formatQty(totalFilteredUnits)} units)
                    </>
                  )}
                </span>
                <span
                  className="inline-flex cursor-default items-center gap-2 rounded-2xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-primary-100 px-5 py-3 text-lg font-bold tabular-nums text-primary-800 shadow-md transition-shadow hover:shadow-lg dark:border-primary-700 dark:from-primary-900/40 dark:to-primary-800/40 dark:text-primary-100"
                  aria-label={`Total stock receipt amount: ${formatCurrency(totalFilteredAmount)}`}
                >
                  <span className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
                    Total Value
                  </span>
                  <span className="text-2xl">{formatCurrency(totalFilteredAmount)}</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteReceipt)}
        onClose={() => {
          setConfirmDeleteReceipt(null);
          setPermanentDeleteLoading(false);
        }}
        onConfirm={() => {
          if (confirmDeleteReceipt) {
            handlePermanentDelete(confirmDeleteReceipt);
          }
        }}
        title="Delete receipt?"
        message={
          confirmDeleteReceipt ? (
            <>
              This removes the receipt from <strong>{confirmDeleteReceipt.supplierName}</strong>,{" "}
              deletes its lines, and reverses the stock that was received. This cannot be undone. The
              operation fails if you have already sold or moved more stock than would remain after
              the reversal.
            </>
          ) : null
        }
        confirmLabel="Delete receipt"
        variant="danger"
        loading={permanentDeleteLoading}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteLine)}
        onClose={() => setConfirmDeleteLine(null)}
        onConfirm={handleConfirmDeleteLine}
        title="Remove this line from the receipt?"
        message={
          confirmDeleteLine ? (
            <>
              <strong>{confirmDeleteLine.line.itemName}</strong> (qty{" "}
              {formatQty(confirmDeleteLine.line.qty)}) will be removed and stock on hand will be
              adjusted to match.
            </>
          ) : null
        }
        confirmLabel="Remove line"
        variant="danger"
        loading={updateMutation.isPending}
      />

      <SlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditingGrn(null);
          setEditingSingleLineId(null);
        }}
        title={
          editingGrn
            ? editingSingleLineId
              ? "Edit line"
              : "Edit stock receipt"
            : "Receive stock"
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              {formError}
            </div>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Branch: <strong>{selectedBranch?.name ?? "—"}</strong>
          </p>
          <div>
            <label
              htmlFor="grn-supplier"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Supplier *
            </label>
            <SearchableSelect
              id="grn-supplier"
              options={[
                { value: "", label: "Select supplier…" },
                ...suppliers.map((s: Supplier) => ({ value: s.id, label: s.name })),
              ]}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Select supplier…"
              className="w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="grn-received-at"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Received at *
              </label>
              {!editingGrn && (
                <button
                  type="button"
                  onClick={() => {
                    const now = formatDateInput(new Date());
                    setReceivedAt(now);
                    saveGoodsReceiptReceivedAt(now, selectedOrgId, selectedBranchId);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-200 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Set to today
                </button>
              )}
            </div>
            <DateInput
              id="grn-received-at"
              value={receivedAt}
              onChange={(e) => {
                const val = e.target.value;
                setReceivedAt(val);
                if (!editingGrn) {
                  saveGoodsReceiptReceivedAt(val, selectedOrgId, selectedBranchId);
                }
              }}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {editingGrn
                ? editingSingleLineId
                  ? "Line on receipt"
                  : "Receipt lines"
                : "Items to receive as stock"}
            </label>
            {!editingSingleLineId ? (
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 shadow-sm transition hover:bg-primary-100 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-primary-700/80 dark:bg-primary-950/60 dark:text-primary-300 dark:hover:bg-primary-900/60 dark:hover:border-primary-600"
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </button>
            ) : null}
          </div>
          {!editingGrn ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Items already on another receipt from the selected supplier received on this date at this branch are
              hidden. Edit that receipt if you need to change them.
            </p>
          ) : null}
          {showBarcode && !editingSingleLineId && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-800/50">
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Scan barcode to add item
              </label>
              <BarcodeCaptureInput
                onScan={handleBarcodeScan}
                placeholder="Scan or type barcode…"
                disabled={!token || !selectedOrgId}
              />
              {barcodeScanMessage && (
                <p
                  className={`mt-1.5 text-sm ${
                    barcodeScanMessage.type === "error"
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                  role={barcodeScanMessage.type === "error" ? "alert" : "status"}
                >
                  {barcodeScanMessage.text}
                </p>
              )}
            </div>
          )}
          <div className="space-y-3">
            {lines.map((line, idx) => {
              const itemIdsOnOtherLines = new Set(
                lines
                  .map((l, i) => (i !== idx && l.itemId ? l.itemId : null))
                  .filter((id): id is string => Boolean(id))
              );
              const selectableItems = items.filter((it) => {
                if (it.buyingPrice == null) {
                  return false;
                }
                if (it.id === line.itemId) {
                  return true;
                }
                if (itemIdsOnOtherLines.has(it.id)) {
                  return false;
                }
                if (!itemIdsReceivedOnSelectedDateOtherGrns.has(it.id)) {
                  return true;
                }
                return Boolean(editingGrn && originalGrnItemIds.has(it.id));
              });
              return (
              <div
                key={idx}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-800/50"
              >
                <div className="min-w-[180px] flex-1">
                  <label
                    className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                    htmlFor={`grn-item-${idx}`}
                  >
                    Item
                  </label>
                  <ItemSearchCombobox
                    inputId={`grn-item-${idx}`}
                    items={selectableItems}
                    value={line.itemId}
                    onChange={(id) => handleUpdateLine(idx, "itemId", id)}
                  />
                </div>
                <div className="w-full sm:w-24">
                  <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Qty *
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.qty}
                    onChange={(e) => handleUpdateLine(idx, "qty", e.target.value)}
                    placeholder="0"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div className="w-full sm:w-24">
                  <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Unit cost
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={
                      line.receivedUnitCost
                        ? formatCurrency(parseFloat(line.receivedUnitCost))
                        : "—"
                    }
                    title="Set from item buying price in Catalog."
                    className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm tabular-nums text-slate-600 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-400"
                    tabIndex={-1}
                  />
                </div>
                <div className="w-full sm:w-28">
                  <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Total cost
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={
                      line.qty && line.receivedUnitCost
                        ? formatCurrency(
                            parseFloat(line.qty) *
                              parseFloat(line.receivedUnitCost)
                          )
                        : "—"
                    }
                    className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm tabular-nums text-slate-600 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-400"
                    tabIndex={-1}
                    aria-label="Total cost (auto-calculated)"
                  />
                </div>
                {!editingSingleLineId ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    aria-label={`Remove line ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setSlideOpen(false)}
              className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-200 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
            >
              {submitLoading
                ? editingGrn
                  ? "Saving…"
                  : "Receiving…"
                : editingGrn
                  ? editingSingleLineId
                    ? "Save line"
                    : "Save"
                  : "Receive stock"}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
