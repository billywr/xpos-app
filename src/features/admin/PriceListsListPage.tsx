import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchItems } from "@/api/items";
import {
  fetchPriceLists,
  fetchPriceList,
  createPriceList,
  updatePriceList,
  deletePriceList,
  fetchPriceListItems,
  addPriceListItem,
  deletePriceListItem,
} from "@/api/priceLists";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import type { PriceList } from "@/types/sales";
import type { PriceListItem } from "@/types/sales";
import type { Item } from "@/types/catalog";
import { SlideOver, Pagination, ConfirmDialog } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { formatCurrency } from "@/utils/formatCurrency";
import { Plus, Pencil, Trash2 } from "lucide-react";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CURRENCY = "KES";

export function PriceListsListPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [formBranchId, setFormBranchId] = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formName, setFormName] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [newItemId, setNewItemId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState(DEFAULT_CURRENCY);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PriceList | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: priceListsData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-price-lists", token, selectedOrgId, page, size],
    queryFn: () => fetchPriceLists(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const { data: itemsData } = useQuery({
    queryKey: ["admin-items", token, selectedOrgId],
    queryFn: () => fetchItems(token, selectedOrgId, { size: 500 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const { data: selectedListData } = useQuery({
    queryKey: [
      "admin-price-list",
      token,
      selectedOrgId,
      editingList?.id,
    ],
    queryFn: () =>
      fetchPriceList(token, selectedOrgId, editingList!.id),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(editingList) &&
      slideOpen,
  });

  const { data: priceListItemsData } = useQuery({
    queryKey: [
      "admin-price-list-items",
      token,
      selectedOrgId,
      editingList?.id,
    ],
    queryFn: () =>
      fetchPriceListItems(token, selectedOrgId, editingList!.id),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(editingList) &&
      slideOpen,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      branchId: string | null;
      channel: string | null;
      name: string;
      priority: number;
      active: boolean;
    }) => createPriceList(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-lists", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["priceLists", selectedOrgId],
      });
      setSlideOpen(false);
      setEditingList(null);
      resetForm();
      toast.success("Price list created.", { title: "Created" });
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
      priceListId: string;
      branchId: string | null;
      channel: string | null;
      name: string;
      priority: number;
      active: boolean;
    }) =>
      updatePriceList(token, selectedOrgId, body.priceListId, {
        branchId: body.branchId,
        channel: body.channel,
        name: body.name,
        priority: body.priority,
        active: body.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-lists", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list", token, selectedOrgId, editingList?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["priceLists", selectedOrgId],
      });
      setSlideOpen(false);
      setEditingList(null);
      resetForm();
      setSubmitLoading(false);
      toast.success("Price list updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (priceListId: string) =>
      deletePriceList(token, selectedOrgId, priceListId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-lists", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["priceLists", selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Price list deleted.", { title: "Deleted" });
    },
    onError: (err) => {
      setDeleteLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (payload: {
      itemId: string;
      price: number;
      currency: string;
    }) =>
      addPriceListItem(
        token,
        selectedOrgId,
        editingList!.id,
        payload.itemId,
        payload.price,
        payload.currency
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "admin-price-list-items",
          token,
          selectedOrgId,
          editingList?.id,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["priceListItems", selectedOrgId, editingList?.id],
      });
      setNewItemId("");
      setNewPrice("");
      setNewCurrency(DEFAULT_CURRENCY);
      toast.success("Price list item added.", { title: "Added" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (priceListItemId: string) =>
      deletePriceListItem(
        token,
        selectedOrgId,
        editingList!.id,
        priceListItemId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "admin-price-list-items",
          token,
          selectedOrgId,
          editingList?.id,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["priceListItems", selectedOrgId, editingList?.id],
      });
      toast.success("Price list item removed.", { title: "Removed" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const priceLists = priceListsData?.content ?? [];
  const totalElements = priceListsData?.totalElements ?? 0;
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const items = itemsData?.content ?? [];
  const priceListItems = priceListItemsData ?? [];
  const assignedItemIds = new Set(priceListItems.map((pli: PriceListItem) => pli.itemId));
  const availableItems = items.filter(
    (i: Item) => !assignedItemIds.has(i.id)
  );

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (selectedListData) {
      setFormBranchId(selectedListData.branchId ?? "");
      setFormChannel(selectedListData.channel ?? "");
      setFormName(selectedListData.name);
      setFormPriority(selectedListData.priority);
      setFormActive(selectedListData.active);
    }
  }, [selectedListData]);

  function resetForm() {
    setFormBranchId("");
    setFormChannel("");
    setFormName("");
    setFormPriority(0);
    setFormActive(true);
    setFormError(null);
    setNewItemId("");
    setNewPrice("");
    setNewCurrency(DEFAULT_CURRENCY);
  }

  const openCreate = () => {
    setEditingList(null);
    resetForm();
    setSlideOpen(true);
  };

  const openEdit = (list: PriceList) => {
    setEditingList(list);
    setFormError(null);
    setNewItemId("");
    setNewPrice("");
    setNewCurrency(DEFAULT_CURRENCY);
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditingList(null);
    setFormError(null);
  };

  const handleListSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError("Name is required.");
      return;
    }
    const payload = {
      branchId: formBranchId || null,
      channel: formChannel.trim() || null,
      name: trimmed,
      priority: formPriority,
      active: formActive,
    };
    setSubmitLoading(true);
    if (editingList) {
      updateMutation.mutate(
        { ...payload, priceListId: editingList.id },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(payload, { onSettled: () => setSubmitLoading(false) });
    }
  };

  const handleAddItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingList || !newItemId) return;
    const priceNum = Number.parseFloat(newPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error("Enter a valid price (number ≥ 0).");
      return;
    }
    addItemMutation.mutate({
      itemId: newItemId,
      price: priceNum,
      currency: newCurrency.trim() || DEFAULT_CURRENCY,
    });
  };

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  const handleDeleteConfirm = () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    deleteMutation.mutate(confirmDelete.id);
  };

  const branchName = (branchId: string | null) =>
    branchId
      ? branches.find((b: Branch) => b.id === branchId)?.name ?? branchId
      : "—";
  const itemName = (itemId: string) =>
    items.find((i: Item) => i.id === itemId)?.name ?? itemId;

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Price lists
        </h1>
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId) {
    const message = getApiErrorMessage(error);
    const requestId = getApiErrorRequestId(error);
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Price lists
        </h1>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{message}</p>
          {requestId && (
            <p className="mt-2 text-sm opacity-90">
              Reference:{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                {requestId}
              </code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Price lists
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Pricing by branch/channel. Add items and set prices per list.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="price-list-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="price-list-org-select"
          value={selectedOrgId}
          onChange={(e) => {
            setSelectedOrgId(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select organization…</option>
          {orgs.map((o: Org) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {selectedOrgId && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add price list
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage price lists.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Active
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {priceLists.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No price lists yet. Add one to set prices by branch/channel.
                      </td>
                    </tr>
                  ) : (
                    priceLists.map((list: PriceList) => (
                      <tr
                        key={list.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {list.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {branchName(list.branchId)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {list.priority}
                        </td>
                        <td className="px-4 py-3">
                          {list.active ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Yes
                            </span>
                          ) : (
                            <span className="text-slate-500">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(list)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              aria-label={`Edit ${list.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(list)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              aria-label={`Delete ${list.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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
                onSizeChange={handleSizeChange}
                sizeOptions={[10, 25, 50, 100]}
              />
            )}
          </div>

          <SlideOver
            open={slideOpen}
            onClose={closeSlide}
            title={editingList ? "Edit price list" : "Add price list"}
            maxWidth="max-w-xl"
          >
            <form onSubmit={handleListSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="price-list-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
                <input
                  id="price-list-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. Default"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="price-list-branch"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Branch
                </label>
                <select
                  id="price-list-branch"
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  <option value="">None</option>
                  {branches.map((b: Branch) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="price-list-channel"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Channel (optional)
                </label>
                <input
                  id="price-list-channel"
                  type="text"
                  value={formChannel}
                  onChange={(e) => setFormChannel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. RETAIL"
                />
              </div>
              <div>
                <label
                  htmlFor="price-list-priority"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Priority
                </label>
                <input
                  id="price-list-priority"
                  type="number"
                  min={0}
                  value={formPriority}
                  onChange={(e) =>
                    setFormPriority(Number.parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
                Active
              </label>

              {!editingList ? (
                <p className="border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Save this price list, then click <strong>Edit</strong> (pencil)
                  on it to add menu items and set their prices.
                </p>
              ) : (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-white">
                    Menu item prices
                  </h3>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    Add catalog items and set prices for this list. These prices
                    appear on the Operator Menu Order.
                  </p>
                  {priceListItems.length === 0 ? (
                    <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                      No items in this list yet. Add items below.
                    </p>
                  ) : (
                    <ul className="mb-3 space-y-1">
                      {priceListItems.map((pli: PriceListItem) => (
                        <li
                          key={pli.id}
                          className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-sm dark:bg-slate-700/50"
                        >
                          <span className="text-slate-800 dark:text-slate-200">
                            {itemName(pli.itemId)}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-primary-600 dark:text-primary-400">
                              {formatCurrency(Number(pli.price))}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                deleteItemMutation.mutate(pli.id)
                              }
                              className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                              aria-label={`Remove ${itemName(pli.itemId)}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {itemsData === undefined && slideOpen ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Loading catalog items…
                    </p>
                  ) : items.length === 0 ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      No catalog items yet. Add items in <strong>Catalog → Items</strong> first,
                      then come back here to set their prices.
                    </p>
                  ) : availableItems.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      All catalog items already have prices in this list.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1 basis-32">
                        <label
                          htmlFor="new-item"
                          className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Item
                        </label>
                        <select
                          id="new-item"
                          value={newItemId}
                          onChange={(e) => setNewItemId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        >
                          <option value="">Select item…</option>
                          {availableItems.map((i: Item) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28">
                        <label
                          htmlFor="new-price"
                          className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Price
                        </label>
                        <input
                          id="new-price"
                          type="text"
                          inputMode="decimal"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="w-20">
                        <label
                          htmlFor="new-currency"
                          className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Currency
                        </label>
                        <input
                          id="new-currency"
                          type="text"
                          value={newCurrency}
                          onChange={(e) => setNewCurrency(e.target.value)}
                          placeholder="KES"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddItem()}
                        disabled={
                          !newItemId ||
                          !newPrice.trim() ||
                          addItemMutation.isPending
                        }
                        className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                      >
                        {addItemMutation.isPending ? "Adding…" : "Add price"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={closeSlide}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {submitLoading
                    ? "Saving…"
                    : editingList
                      ? "Save"
                      : "Create"}
                </button>
              </div>
            </form>
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete price list?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.name}</strong> will be deactivated. It
                  will no longer be used for pricing.
                </>
              ) : (
                ""
              )
            }
            confirmLabel="Delete"
            variant="danger"
            loading={deleteLoading}
          />
        </>
      )}
    </div>
  );
}
