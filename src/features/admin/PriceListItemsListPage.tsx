import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchPriceLists } from "@/api/priceLists";
import {
  fetchPriceListItems,
  addPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
} from "@/api/priceLists";
import { fetchAllOrgItems } from "@/api/items";
import type { Item } from "@/types/catalog";
import { filterActiveOrgs } from "@/types/org";
import type { PriceListItem } from "@/types/sales";
import { Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorCode, getApiErrorRequestId } from "@/utils/apiError";
import { messageIfSellingAtOrBelowBuyingPrice } from "@/utils/priceListSellingValidation";
import { useToast } from "@/contexts/ToastContext";
import { formatCurrency } from "@/utils/formatCurrency";
import { Pencil, Trash2, Plus, Loader2, ListChecks } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

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
  const [addItemPriceError, setAddItemPriceError] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<PriceListItem | null>(null);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });
  const orgs = filterActiveOrgs(orgsData?.content ?? []);

  const { data: priceListsData } = useQuery({
    queryKey: ["admin-price-lists", token, selectedOrgId],
    queryFn: () => fetchPriceLists(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: catalogItems, isLoading: catalogItemsLoading } = useQuery({
    queryKey: ["admin-catalog-items-all", token, selectedOrgId],
    queryFn: () => fetchAllOrgItems(token, selectedOrgId),
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
  const { searchQuery, setSearchQuery, filteredRows: filteredPriceListItems } = useTableSearch(priceListItems);
  const totalItems = priceListItemsPage?.totalElements ?? 0;
  const assignedItemIds = new Set(
    (allAssignedData?.content ?? []).map((pli) => pli.itemId)
  );
  const items = catalogItems ?? [];
  const unassignedCatalogItems = items.filter((i: Item) => !assignedItemIds.has(i.id));
  const selectedPriceList = priceLists.find((pl) => pl.id === selectedPriceListId);

  useEffect(() => {
    if (initialOrgId) {
      if (selectedOrgId !== initialOrgId) {
        setSelectedOrgId(initialOrgId);
        setSelectedPriceListId("");
      }
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  useEffect(() => {
    const lists = priceListsData?.content ?? [];
    if (lists.length > 0 && !selectedPriceListId) {
      setSelectedPriceListId(lists[0].id);
    }
  }, [priceListsData?.content, selectedPriceListId]);

  const priceListSelectOptions = useMemo(
    () => [
      { value: "", label: "Select a price list…" },
      ...priceLists.map((pl) => ({ value: pl.id, label: pl.name })),
    ],
    [priceLists]
  );

  const pliNewItemOptions = useMemo(
    () => [
      { value: "", label: "Select item…" },
      ...unassignedCatalogItems.map((i: Item) => ({ value: i.id, label: i.name })),
    ],
    [unassignedCatalogItems]
  );

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
        title:
          code === "SELLING_PRICE_BELOW_COST"
            ? "Selling price too low"
            : code === "ITEM_NOT_SUPPLIED"
              ? "Item not supplied"
              : undefined,
        detail: requestId ? `Reference: ${requestId}` : undefined,
        action:
          code === "ITEM_NOT_SUPPLIED"
            ? {
                label: "Go to receive stock",
                href: selectedOrgId
                  ? `/admin/inventory?orgId=${selectedOrgId}&tab=stock`
                  : "/admin/inventory?tab=stock",
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
      const code = getApiErrorCode(err);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        title:
          code === "SELLING_PRICE_BELOW_COST" ? "Selling price too low" : undefined,
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
      setAddItemPriceError(null);
      toast.error("Enter a valid selling price (number ≥ 0).");
      return;
    }
    const catalogItem = items.find((i) => i.id === newItemId);
    const buyingMsg = messageIfSellingAtOrBelowBuyingPrice(
      priceNum,
      catalogItem?.buyingPrice
    );
    if (buyingMsg) {
      setAddItemPriceError(buyingMsg);
      toast.error(buyingMsg, { title: "Selling price too low" });
      return;
    }
    setAddItemPriceError(null);
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
    const line = priceListItems.find((p) => p.id === lineId);
    const catalogItem = line ? items.find((i) => i.id === line.itemId) : undefined;
    const buyingMsg = messageIfSellingAtOrBelowBuyingPrice(
      priceNum,
      catalogItem?.buyingPrice
    );
    if (buyingMsg) {
      toast.error(buyingMsg, { title: "Selling price too low" });
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
          <SearchableSelect
            id="pli-price-list"
            options={priceListSelectOptions}
            value={selectedPriceListId}
            onChange={(next) => {
              setSelectedPriceListId(next);
              setItemsPage(0);
              setEditingLineId(null);
              setDeleteConfirmLine(null);
            }}
            placeholder="Search price list…"
            compact
            className="min-w-[220px]"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
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

          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search price list items…" className="mx-4 mt-3" />
          {itemsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredPriceListItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              {priceListItems.length === 0 ? "No items in this list yet. Add items below." : "No results match your search."}
            </div>
          ) : (
            <>
              {totalItems > 0 && (
                <Pagination
                  position="top"
                  page={itemsPage}
                  size={itemsSize}
                  totalElements={totalItems}
                  onPageChange={setItemsPage}
                />
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Buying Price
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Selling Price
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {filteredPriceListItems.map((pli) => (
                      <tr
                        key={pli.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {pli.itemName ?? pli.itemId}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                          {pli.buyingPrice != null
                            ? formatCurrency(Number(pli.buyingPrice))
                            : "—"}
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
            {catalogItemsLoading ? (
              <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                Loading catalog items…
              </p>
            ) : items.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                No catalog items yet. Add items in the <strong>Items</strong> tab first.
              </p>
            ) : unassignedCatalogItems.length === 0 ? (
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
                  <SearchableSelect
                    id="pli-new-item"
                    options={pliNewItemOptions}
                    value={newItemId}
                    onChange={(v) => {
                      setNewItemId(v);
                      setAddItemPriceError(null);
                    }}
                    placeholder="Search item…"
                    className="w-full"
                    controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                  />
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
                    onChange={(e) => {
                      setNewPrice(e.target.value);
                      setAddItemPriceError(null);
                    }}
                    placeholder="0.00"
                    aria-invalid={Boolean(addItemPriceError)}
                    aria-describedby={
                      addItemPriceError ? "pli-new-price-error" : undefined
                    }
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-slate-900 dark:bg-slate-700 dark:text-white ${
                      addItemPriceError
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  />
                  {addItemPriceError ? (
                    <p
                      id="pli-new-price-error"
                      className="mt-1 max-w-sm text-sm text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {addItemPriceError}
                    </p>
                  ) : null}
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
