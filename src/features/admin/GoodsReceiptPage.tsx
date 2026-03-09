import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchSuppliers } from "@/api/suppliers";
import { fetchItems, fetchItemByBarcode } from "@/api/items";
import {
  fetchGoodsReceiptNotes,
  createGoodsReceiptNote,
  updateGoodsReceiptNote,
  type GrnLineRequest,
  type GoodsReceiptNoteResponse,
} from "@/api/goodsReceiptNotes";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import type { Item } from "@/types/catalog";
import type { Supplier } from "@/api/suppliers";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, Pagination, ConfirmDialog } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatCurrency";
import { useToast } from "@/contexts/ToastContext";
import { Link } from "react-router-dom";
import { Plus, PackagePlus, Trash2, Pencil } from "lucide-react";
import { BarcodeCaptureInput } from "@/components/BarcodeCaptureInput";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import {
  BARCODE_GOODS_RECEIPT,
  isBarcodeVisible,
} from "@/config/barcodeVisibility";

const DEFAULT_PAGE_SIZE = 10;

interface GrnLineForm {
  itemId: string;
  itemName: string;
  qty: string;
  uomId: string;
  receivedUnitCost: string;
}

export interface GoodsReceiptPageProps {
  initialOrgId?: string;
  initialBranchId?: string;
  onOrgChange?: (orgId: string) => void;
  onBranchChange?: (branchId: string) => void;
}

export function GoodsReceiptPage({
  initialOrgId,
  initialBranchId,
  onOrgChange,
  onBranchChange,
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
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingGrn, setEditingGrn] = useState<GoodsReceiptNoteResponse | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [receivedAt, setReceivedAt] = useState<string>("");
  const [lines, setLines] = useState<GrnLineForm[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] =
    useState<GoodsReceiptNoteResponse | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
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

  const { data: grnsData, isLoading, isError, error } = useQuery({
    queryKey: [
      "admin-grns",
      token,
      selectedOrgId,
      selectedBranchId,
      page,
      size,
      includeInactive,
    ],
    queryFn: () =>
      fetchGoodsReceiptNotes(token, selectedOrgId, selectedBranchId, {
        page,
        size,
        includeInactive,
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
      lines: GrnLineRequest[];
    }) => createGoodsReceiptNote(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-grns", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      setSlideOpen(false);
      setEditingGrn(null);
      setSupplierId("");
      setLines([]);
      setFormError(null);
      setSubmitLoading(false);
      toast.success("Goods receipt created. Stock updated.", { title: "Received" });
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
      active?: boolean;
      lines?: Array<{ itemId: string; qty: number; uomId?: string | null; receivedUnitCost?: number | null }>;
    }) =>
      updateGoodsReceiptNote(token, selectedOrgId, body.grnId, {
        supplierId: body.supplierId,
        receivedAt: body.receivedAt,
        active: body.active,
        lines: body.lines,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-grns", token, selectedOrgId, selectedBranchId],
      });
      if (variables.lines != null) {
        queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      }
      setSlideOpen(false);
      setEditingGrn(null);
      setConfirmDeactivate(null);
      setDeactivateLoading(false);
      setFormError(null);
      setSubmitLoading(false);
      toast.success("Receipt updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      setDeactivateLoading(false);
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
  const grns = grnsData?.content ?? [];
  const totalElements = grnsData?.totalElements ?? 0;

  const grnsTotalAmount = grns.reduce(
    (sum, grn) =>
      sum +
      grn.lines.reduce(
        (s, l) => s + l.qty * (l.receivedUnitCost ?? 0),
        0
      ),
    0
  );

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
        uomId: "",
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
        if (item?.buyingPrice != null) {
          next[idx].receivedUnitCost = String(item.buyingPrice);
        }
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
        setScannedItems((prev) =>
          prev.some((i) => i.id === item.id) ? prev : [...prev, item]
        );
        setLines((prev) => {
          const emptyIdx = prev.findIndex((l) => !l.itemId);
          const idx = emptyIdx >= 0 ? emptyIdx : prev.length;
          const newLine = {
            itemId: item.id,
            itemName: item.name,
            qty: idx < prev.length ? prev[idx].qty : "1",
            uomId: "",
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
    [token, selectedOrgId]
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
      setSubmitLoading(true);
      updateMutation.mutate({
        grnId: editingGrn.id,
        supplierId,
        receivedAt: toISOReceivedAt(rt),
        lines: validLines.map((l) => ({
          itemId: l.itemId,
          qty: parseFloat(l.qty),
          uomId: l.uomId || null,
          receivedUnitCost: l.receivedUnitCost ? parseFloat(l.receivedUnitCost) : null,
        })),
      });
      return;
    }
    const validLines = lines
      .filter((l) => l.itemId && l.qty && parseFloat(l.qty) > 0)
      .map((l): GrnLineRequest => ({
        itemId: l.itemId,
        qty: parseFloat(l.qty),
        uomId: l.uomId || null,
        receivedUnitCost: l.receivedUnitCost
          ? parseFloat(l.receivedUnitCost)
          : null,
      }));
    if (validLines.length === 0) {
      setFormError("Add at least one line with item and quantity");
      return;
    }
    setSubmitLoading(true);
    createMutation.mutate({
      branchId: selectedBranchId,
      supplierId,
      lines: validLines,
    });
  };

  const formatDatetimeLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /** Convert datetime-local value to ISO-8601 for API (Instant expects seconds + timezone). */
  const toISOReceivedAt = (datetimeLocal: string): string => {
    const s = datetimeLocal.trim();
    if (!s) return s;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
      return new Date(s + ":00").toISOString();
    }
    return new Date(s).toISOString();
  };

  const handleEdit = (grn: GoodsReceiptNoteResponse) => {
    setEditingGrn(grn);
    setSupplierId(grn.supplierId);
    setReceivedAt(
      grn.receivedAt ? formatDatetimeLocal(grn.receivedAt) : formatDatetimeLocal(new Date().toISOString())
    );
    setLines(
      grn.lines.length > 0
        ? grn.lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            qty: String(l.qty),
            uomId: l.uomId ?? "",
            receivedUnitCost:
              l.receivedUnitCost != null ? String(l.receivedUnitCost) : "",
          }))
        : [{ itemId: "", itemName: "", qty: "", uomId: "", receivedUnitCost: "" }]
    );
    setFormError(null);
    setBarcodeScanMessage(null);
    setSlideOpen(true);
  };

  const handleDeactivate = () => {
    if (!confirmDeactivate) return;
    setDeactivateLoading(true);
    updateMutation.mutate({
      grnId: confirmDeactivate.id,
      supplierId: confirmDeactivate.supplierId,
      receivedAt: confirmDeactivate.receivedAt,
      active: false,
    });
  };

  const handleReactivate = (grn: GoodsReceiptNoteResponse) => {
    updateMutation.mutate({
      grnId: grn.id,
      supplierId: grn.supplierId,
      receivedAt: grn.receivedAt,
      active: true,
    });
  };

  const selectedBranch = branches.find((b: Branch) => b.id === selectedBranchId);

  if (isLoading && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Goods Receipt"
          subtitle="Loading…"
          icon={PackagePlus}
          fallbackTo="/admin"
        />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Goods Receipt"
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
          title="Goods Receipt"
          subtitle="Receive stock at a branch. Select branch and supplier, then add items with quantities to increase inventory."
          icon={PackagePlus}
          fallbackTo="/admin"
          noMargin
        />
        <button
          type="button"
          onClick={() => {
            setEditingGrn(null);
            setSlideOpen(true);
            setFormError(null);
            setSupplierId(suppliers[0]?.id ?? "");
            setReceivedAt(formatDatetimeLocal(new Date().toISOString()));
            setLines([{ itemId: "", itemName: "", qty: "", uomId: "", receivedUnitCost: "" }]);
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
          Receive goods
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="grn-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="grn-org-select"
          value={selectedOrgId}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedOrgId(next);
            setSelectedBranchId("");
            onOrgChange?.(next);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select organization…</option>
          {orgs.map((org: Org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <label
          htmlFor="grn-branch-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Branch
        </label>
        <select
          id="grn-branch-select"
          value={selectedBranchId}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedBranchId(next);
            onBranchChange?.(next);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select branch…</option>
          {branches.map((branch: Branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              setPage(0);
            }}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Include deleted
          </span>
        </label>
      </div>

      {suppliers.length === 0 && selectedOrgId && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          No suppliers for this organization.{" "}
          <Link
            to="/admin/suppliers"
            className="font-medium underline hover:no-underline"
          >
            Add a supplier
          </Link>{" "}
          to receive goods.
        </div>
      )}

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select organization and branch to view receipts and receive goods.
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Recent receipts
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Received at
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Barcode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Buying price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {grns.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {includeInactive
                          ? "No goods receipts (active or deleted)."
                          : "No goods receipts yet. Click &quot;Receive goods&quot; to add stock."}
                      </td>
                    </tr>
                  ) : (
                    grns.map((grn: GoodsReceiptNoteResponse) => (
                      <tr
                        key={grn.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                          !grn.active ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-800 dark:text-white">
                          {new Date(grn.receivedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {grn.supplierName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {grn.lines.map((l) => l.itemName).join(", ")}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600 dark:text-slate-300">
                          {grn.lines.map((l) => l.barcode ?? "—").join(", ")}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {grn.lines.map((l) => l.qty).join(", ")}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                          {grn.lines
                            .map((l) =>
                              l.receivedUnitCost != null
                                ? formatCurrency(l.receivedUnitCost)
                                : "—"
                            )
                            .join(", ")}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                          {formatCurrency(
                            grn.lines.reduce(
                              (sum, l) =>
                                sum +
                                l.qty * (l.receivedUnitCost ?? 0),
                              0
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-left">
                          {grn.active ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEdit(grn)}
                                className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                                title="Edit"
                                aria-label={`Edit receipt ${grn.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeactivate(grn)}
                                className="rounded p-2 text-slate-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-slate-600 dark:hover:text-red-300"
                                title="Delete (soft)"
                                aria-label={`Delete receipt ${grn.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(grn)}
                              className="rounded px-2 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:hover:text-primary-400"
                            >
                              Reactivate
                            </button>
                          )}
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
                  setPage(0);
                }}
                sizeOptions={[10, 25, 50]}
              />
            )}
          </div>

          {grns.length > 0 && (
            <div
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-600 dark:bg-slate-900"
              aria-label="Total goods receipt amount summary"
            >
              <div className="flex justify-end">
                <span
                  className="inline-flex cursor-default items-center gap-2 rounded-2xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-primary-100 px-5 py-3 text-lg font-bold tabular-nums text-primary-800 shadow-md transition-shadow hover:shadow-lg dark:border-primary-700 dark:from-primary-900/40 dark:to-primary-800/40 dark:text-primary-100"
                  aria-label={`Total goods receipt amount: ${formatCurrency(grnsTotalAmount)}`}
                >
                  <span className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
                    Total
                  </span>
                  <span className="text-2xl">{formatCurrency(grnsTotalAmount)}</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeactivate)}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivate}
        title="Delete receipt?"
        message={
          confirmDeactivate ? (
            <>
              This will mark the receipt from{" "}
              <strong>{confirmDeactivate.supplierName}</strong> as deleted. It will
              be hidden from the list. Stock already received will not be reversed.
            </>
          ) : null
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deactivateLoading}
      />

      <SlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditingGrn(null);
        }}
        title={editingGrn ? "Edit receipt" : "Receive goods"}
        maxWidth="max-w-xl"
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
            <select
              id="grn-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s: Supplier) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {editingGrn && (
            <div>
              <label
                htmlFor="grn-received-at"
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Received at *
              </label>
              <input
                id="grn-received-at"
                type="datetime-local"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required={Boolean(editingGrn)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {editingGrn ? "Receipt lines" : "Items to receive"}
            </label>
            <button
              type="button"
              onClick={handleAddLine}
              className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              + Add line
            </button>
          </div>
          {showBarcode && (
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
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-800/50"
              >
                <div className="min-w-[180px] flex-1">
                  <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Item
                  </label>
                  <select
                    value={line.itemId}
                    onChange={(e) =>
                      handleUpdateLine(idx, "itemId", e.target.value)
                    }
                    required={lines.length === 1}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">Select…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
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
                <div className="w-24">
                  <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Unit cost
                    {items.find((i) => i.id === line.itemId)?.buyingPrice != null && (
                      <span className="ml-1 text-slate-500 dark:text-slate-400">
                        (from item)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.receivedUnitCost}
                    onChange={(e) =>
                      handleUpdateLine(idx, "receivedUnitCost", e.target.value)
                    }
                    placeholder="—"
                    readOnly={
                      items.find((i) => i.id === line.itemId)?.buyingPrice != null
                    }
                    title={
                      items.find((i) => i.id === line.itemId)?.buyingPrice != null
                        ? "Unit cost is set from item buying price and cannot be changed here."
                        : undefined
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-700 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="w-28">
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
                <button
                  type="button"
                  onClick={() => handleRemoveLine(idx)}
                  className="rounded p-2 text-slate-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-slate-600 dark:hover:text-red-300"
                  aria-label={`Remove line ${idx + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setSlideOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
            >
              {submitLoading
                ? editingGrn
                  ? "Saving…"
                  : "Receiving…"
                : editingGrn
                  ? "Save"
                  : "Receive"}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
