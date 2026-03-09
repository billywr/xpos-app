import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchPriceLists } from "@/api/priceLists";
import {
  fetchPriceListItems,
  addPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
} from "@/api/priceLists";
import { fetchItems } from "@/api/items";
import type { Item } from "@/types/catalog";
import type { PriceListItem } from "@/types/sales";
import { Pagination, ConfirmDialog } from "@/components/ui";
import { getApiErrorMessage, getApiErrorCode, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { formatCurrency } from "@/utils/formatCurrency";
import { Pencil, Trash2, Plus, Loader2, ListChecks } from "lucide-react";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CURRENCY = "KES";

export interface PriceListItemsListPageProps {
  initialOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

export function PriceListItemsListPage({
  initialOrgId,
}: PriceListItemsListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState(initialOrgId ?? "");
  const [selectedPriceListId, setSelectedPriceListId] = useState("");
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsSize, setItemsSize] = useState(DEFAULT_PAGE_SIZE);
  const [newItemId, setNewItemId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState(DEFAULT_CURRENCY);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<PriceListItem | null>(null);

  const { data: priceListsData } = useQuery({
    queryKey: ["admin-price-lists", token, selectedOrgId],
    queryFn: () => fetchPriceLists(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: itemsData } = useQuery({
    queryKey: ["admin-items", token, selectedOrgId],
    queryFn: () => fetchItems(token, selectedOrgId, { size: 500 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedPriceListId),
  });

  const {
    data: priceListItemsPage,
    isLoading: itemsLoading,
  } = useQuery({
    queryKey: [
      "admin-price-list-items",
      token,
      selectedOrgId,
      selectedPriceListId,
      itemsPage,
      itemsSize,
    ],
    queryFn: () =>
      fetchPriceListItems(token, selectedOrgId, selectedPriceListId, {
        page: itemsPage,
        size: itemsSize,
      }),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedPriceListId),
  });

  const { data: allAssignedData } = useQuery({
    queryKey: ["admin-price-list-assigned-ids", token, selectedOrgId, selectedPriceListId],
    queryFn: () =>
      fetchPriceListItems(token, selectedOrgId, selectedPriceListId, {
        page: 0,
        size: 2000,
      }),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(selectedPriceListId),
  });

  const priceLists = priceListsData?.content ?? [];
  const priceListItems = priceListItemsPage?.content ?? [];
  const totalItems = priceListItemsPage?.totalElements ?? 0;
  const assignedItemIds = new Set(
    (allAssignedData?.content ?? []).map((pli) => pli.itemId)
  );
  const items = itemsData?.content ?? [];
  const availableItems = items.filter((i: Item) => !assignedItemIds.has(i.id));
  const selectedPriceList = priceLists.find((pl) => pl.id === selectedPriceListId);

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
      setSelectedPriceListId("");
    }
  }, [initialOrgId]);

  useEffect(() => {
    const lists = priceListsData?.content ?? [];
    if (lists.length > 0 && !selectedPriceListId) {
      setSelectedPriceListId(lists[0].id);
    }
  }, [priceListsData?.content, selectedPriceListId]);

  const addItemMutation = useMutation({
    mutationFn: (payload: { itemId: string; price: number; currency: string }) =>
      addPriceListItem(
        token,
        selectedOrgId,
        selectedPriceListId,
        payload.itemId,
        payload.price,
        payload.currency
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-items", token, selectedOrgId, selectedPriceListId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-assigned-ids", token, selectedOrgId, selectedPriceListId],
      });
      setNewItemId("");
      setNewPrice("");
      setNewCurrency(DEFAULT_CURRENCY);
      toast.success("Item added to price list.", { title: "Added" });
    },
    onError: (err) => {
      const code = getApiErrorCode(err);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
        action:
          code === "ITEM_NOT_SUPPLIED"
            ? {
                label: "Go to Goods Receipt",
                href: selectedOrgId
                  ? `/admin/goods-receipt?orgId=${selectedOrgId}`
                  : "/admin/goods-receipt",
              }
            : undefined,
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ lineId, price }: { lineId: string; price: number }) =>
      updatePriceListItem(token, selectedOrgId, selectedPriceListId, lineId, {
        price,
        currency: DEFAULT_CURRENCY,
      }),
    onSuccess: () => {
      setEditingLineId(null);
      setEditingPrice("");
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-items", token, selectedOrgId, selectedPriceListId],
      });
      toast.success("Price updated.", { title: "Saved" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (lineId: string) =>
      deletePriceListItem(token, selectedOrgId, selectedPriceListId, lineId),
    onSuccess: () => {
      setDeleteConfirmLine(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-items", token, selectedOrgId, selectedPriceListId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-assigned-ids", token, selectedOrgId, selectedPriceListId],
      });
      toast.success("Item removed from price list.", { title: "Removed" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  function handleAddItem(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newItemId) return;
    const priceNum = Number.parseFloat(newPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error("Enter a valid selling price (number ≥ 0).");
      return;
    }
    addItemMutation.mutate({
      itemId: newItemId,
      price: priceNum,
      currency: newCurrency.trim() || DEFAULT_CURRENCY,
    });
  }

  function handleSavePrice(lineId: string) {
    const priceNum = Number.parseFloat(editingPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error("Enter a valid price (number ≥ 0).");
      return;
    }
    updateItemMutation.mutate({ lineId, price: priceNum });
  }

  function handleSizeChange(newSize: number) {
    setItemsSize(Math.min(newSize, MAX_PAGE_SIZE));
    setItemsPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label
            htmlFor="pli-price-list"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Price list
          </label>
          <select
            id="pli-price-list"
            value={selectedPriceListId}
            onChange={(e) => {
              setSelectedPriceListId(e.target.value);
              setItemsPage(0);
              setEditingLineId(null);
              setDeleteConfirmLine(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white min-w-[220px]"
          >
            <option value="">Select a price list…</option>
            {priceLists.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
          {selectedPriceListId && selectedPriceList && (
            <Link
              to={`/admin/price-lists/${selectedPriceListId}?orgId=${selectedOrgId}`}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline dark:text-primary-400"
            >
              Edit list settings
            </Link>
          )}
        </div>
      </div>

      {!selectedPriceListId ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <ListChecks className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Select a price list above to view and manage its items and prices.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-600">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Items in &quot;{selectedPriceList?.name ?? "…"}&quot;
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Add catalog items and set prices. These prices are used at the till when this list applies.
            </p>
          </div>

          {itemsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : priceListItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No items in this list yet. Add items below.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {priceListItems.map((pli) => (
                      <tr
                        key={pli.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {pli.itemName ?? pli.itemId}
                        </td>
                        <td className="px-4 py-3 text-left">
                          {editingLineId === pli.id ? (
                            <div className="flex items-center justify-start gap-1">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSavePrice(pli.id)}
                                disabled={updateItemMutation.isPending}
                                className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLineId(null);
                                  setEditingPrice("");
                                }}
                                className="rounded px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="font-medium text-primary-600 dark:text-primary-400">
                              {formatCurrency(Number(pli.price))}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center justify-start gap-1">
                            {editingLineId === pli.id ? null : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLineId(pli.id);
                                  setEditingPrice(String(pli.price));
                                }}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-white"
                                title="Edit price"
                                aria-label="Edit price"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmLine(pli)}
                              className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              title="Remove"
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalItems > 0 && (
                <Pagination
                  page={itemsPage}
                  size={itemsSize}
                  totalElements={totalItems}
                  onPageChange={setItemsPage}
                  onSizeChange={handleSizeChange}
                  sizeOptions={[10, 25, 50, 100]}
                />
              )}
            </>
          )}

          <div className="border-t border-slate-200 p-4 dark:border-slate-600">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Add item
            </h3>
            {items.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                No catalog items yet. Add items in the <strong>Items</strong> tab first.
              </p>
            ) : availableItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                All catalog items already have prices in this list.
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[220px]">
                  <label
                    htmlFor="pli-new-item"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Item
                  </label>
                  <select
                    id="pli-new-item"
                    value={newItemId}
                    onChange={(e) => setNewItemId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">Select item…</option>
                    {availableItems.map((i: Item) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[120px]">
                  <label
                    htmlFor="pli-new-price"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Selling (KES)
                  </label>
                  <input
                    id="pli-new-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {addItemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteConfirmLine)}
        onClose={() => setDeleteConfirmLine(null)}
        onConfirm={() =>
          deleteConfirmLine && deleteItemMutation.mutate(deleteConfirmLine.id)
        }
        title="Remove from price list?"
        message={
          deleteConfirmLine
            ? `Remove ${deleteConfirmLine.itemName ?? "this item"} from the price list?`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
