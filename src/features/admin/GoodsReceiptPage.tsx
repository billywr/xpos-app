import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchSuppliers } from "@/api/suppliers";
import { fetchItems } from "@/api/items";
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

const DEFAULT_PAGE_SIZE = 10;

interface GrnLineForm {
  itemId: string;
  itemName: string;
  qty: string;
  uomId: string;
  receivedUnitCost: string;
}

export function GoodsReceiptPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
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
    }) =>
      updateGoodsReceiptNote(token, selectedOrgId, body.grnId, {
        supplierId: body.supplierId,
        receivedAt: body.receivedAt,
        active: body.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-grns", token, selectedOrgId, selectedBranchId],
      });
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
  const items = (itemsData?.content ?? []) as Item[];
  const grns = grnsData?.content ?? [];
  const totalElements = grnsData?.totalElements ?? 0;

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedOrgId, branches, selectedBranchId]);

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
      }
      return next;
    });
  };

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
      setSubmitLoading(true);
      updateMutation.mutate({
        grnId: editingGrn.id,
        supplierId,
        receivedAt: rt,
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

  const handleEdit = (grn: GoodsReceiptNoteResponse) => {
    setEditingGrn(grn);
    setSupplierId(grn.supplierId);
    setReceivedAt(
      grn.receivedAt ? formatDatetimeLocal(grn.receivedAt) : formatDatetimeLocal(new Date().toISOString())
    );
    setFormError(null);
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
            setSelectedOrgId(e.target.value);
            setSelectedBranchId("");
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
          onChange={(e) => setSelectedBranchId(e.target.value)}
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
                      Lines
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
                        colSpan={4}
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
                          {grn.lines
                            .map((l) => `${l.itemName} × ${l.qty}`)
                            .join(", ")}
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

          {!editingGrn && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Items to receive
                </label>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                >
                  + Add line
                </button>
              </div>
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
                    Unit cost (opt)
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
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
            </>
          )}

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
