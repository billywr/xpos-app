import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchBranches } from "@/api/branches";
import { fetchAllOrgItems } from "@/api/items";
import {
  fetchPriceList,
  updatePriceList,
  fetchPriceListItems,
  addPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
} from "@/api/priceLists";
import type { Branch } from "@/types/org";
import { filterNonDeletedBranches } from "@/types/org";
import type { PriceListItem } from "@/types/sales";
import type { Item } from "@/types/catalog";
import { PageHeader } from "@/components/PageHeader";
import { Pagination, ConfirmDialog } from "@/components/ui";
import { getApiErrorMessage, getApiErrorCode, getApiErrorRequestId } from "@/utils/apiError";
import { messageIfSellingAtOrBelowBuyingPrice } from "@/utils/priceListSellingValidation";
import { useToast } from "@/contexts/ToastContext";
import { formatCurrency } from "@/utils/formatCurrency";
import { ArrowLeft, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CURRENCY = "KES";

export function PriceListEditPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { priceListId } = useParams<{ priceListId: string }>();
  const [searchParams] = useSearchParams();
  const orgIdFromUrl = searchParams.get("orgId") ?? "";
  const itemIdFromUrl = searchParams.get("itemId") ?? "";

  const [itemsPage, setItemsPage] = useState(0);
  const [itemsSize, setItemsSize] = useState(DEFAULT_PAGE_SIZE);
  const [formName, setFormName] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [newItemId, setNewItemId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState(DEFAULT_CURRENCY);
  const [addItemPriceError, setAddItemPriceError] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<PriceListItem | null>(null);

  const orgId = orgIdFromUrl;

  const { data: priceList, isLoading, isError, error } = useQuery({
    queryKey: ["admin-price-list", token, orgId, priceListId],
    queryFn: () => fetchPriceList(token, orgId, priceListId!),
    enabled: Boolean(token) && Boolean(orgId) && Boolean(priceListId),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, orgId],
    queryFn: () => fetchBranches(token, orgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(orgId),
  });

  const { data: catalogItems, isLoading: catalogItemsLoading } = useQuery({
    queryKey: ["admin-catalog-items-all", token, orgId],
    queryFn: () => fetchAllOrgItems(token, orgId),
    enabled: Boolean(token) && Boolean(orgId),
  });

  const {
    data: priceListItemsPage,
    isLoading: itemsLoading,
  } = useQuery({
    queryKey: [
      "admin-price-list-items",
      token,
      orgId,
      priceListId,
      itemsPage,
      itemsSize,
    ],
    queryFn: () =>
      fetchPriceListItems(token, orgId, priceListId!, {
        page: itemsPage,
        size: itemsSize,
      }),
    enabled: Boolean(token) && Boolean(orgId) && Boolean(priceListId),
  });

  const { data: allAssignedData } = useQuery({
    queryKey: ["admin-price-list-assigned-ids", token, orgId, priceListId],
    queryFn: () =>
      fetchPriceListItems(token, orgId, priceListId!, {
        page: 0,
        size: 2000,
      }),
    enabled:
      Boolean(token) &&
      Boolean(orgId) &&
      Boolean(priceListId) &&
      Boolean(priceList),
  });

  const priceListItems = priceListItemsPage?.content ?? [];
  const totalItems = priceListItemsPage?.totalElements ?? 0;
  const assignedItemIds = new Set(
    (allAssignedData?.content ?? []).map((pli) => pli.itemId)
  );
  const items = catalogItems ?? [];
  const unassignedCatalogItems = items.filter((i: Item) => !assignedItemIds.has(i.id));

  const branches = filterNonDeletedBranches(branchesData?.content ?? []);

  useEffect(() => {
    if (priceList) {
      setFormName(priceList.name);
      setFormBranchId(priceList.branchId ?? "");
      setFormChannel(priceList.channel ?? "");
      setFormPriority(priceList.priority);
      setFormActive(priceList.active);
    }
  }, [priceList]);

  useEffect(() => {
    if (
      itemIdFromUrl &&
      unassignedCatalogItems.some((i) => i.id === itemIdFromUrl) &&
      !newItemId
    ) {
      setNewItemId(itemIdFromUrl);
    }
  }, [itemIdFromUrl, unassignedCatalogItems, newItemId]);

  const plBranchOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...branches.map((b: Branch) => ({ value: b.id, label: b.name })),
    ],
    [branches]
  );

  const newItemOptions = useMemo(
    () => [
      { value: "", label: "Select item…" },
      ...unassignedCatalogItems.map((i: Item) => ({ value: i.id, label: i.name })),
    ],
    [unassignedCatalogItems]
  );

  const updateListMutation = useMutation({
    mutationFn: () =>
      updatePriceList(token, orgId, priceListId!, {
        branchId: formBranchId || null,
        channel: formChannel.trim() || null,
        name: formName.trim(),
        priority: formPriority,
        active: formActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list", token, orgId, priceListId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-price-lists", token, orgId],
      });
      toast.success("Price list updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
    onSettled: () => setSubmitLoading(false),
  });

  const addItemMutation = useMutation({
    mutationFn: (payload: { itemId: string; price: number; currency: string }) =>
      addPriceListItem(
        token,
        orgId,
        priceListId!,
        payload.itemId,
        payload.price,
        payload.currency
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-items", token, orgId, priceListId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-assigned-ids", token, orgId, priceListId],
      });
      setNewItemId("");
      setNewPrice("");
      setNewCurrency(DEFAULT_CURRENCY);
      toast.success("Price list item added.", { title: "Added" });
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
                href: orgId ? `/admin/inventory?orgId=${orgId}&tab=stock` : "/admin/inventory?tab=stock",
              }
            : undefined,
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      lineId,
      price,
    }: {
      lineId: string;
      price: number;
      currency?: string;
    }) =>
      updatePriceListItem(token, orgId, priceListId!, lineId, {
        price,
        currency: DEFAULT_CURRENCY,
      }),
    onSuccess: () => {
      setEditingLineId(null);
      setEditingPrice("");
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-items", token, orgId, priceListId],
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
        action:
          code === "ITEM_NOT_SUPPLIED"
            ? {
                label: "Go to receive stock",
                href: orgId ? `/admin/inventory?orgId=${orgId}&tab=stock` : "/admin/inventory?tab=stock",
              }
            : undefined,
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (lineId: string) =>
      deletePriceListItem(token, orgId, priceListId!, lineId),
    onSuccess: () => {
      setDeleteConfirmLine(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-items", token, orgId, priceListId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-price-list-assigned-ids", token, orgId, priceListId],
      });
      toast.success("Price list item removed.", { title: "Removed" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  function handleSaveList(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = formName.trim();
    if (!trimmed) {
      toast.error("Name is required.");
      return;
    }
    setSubmitLoading(true);
    updateListMutation.mutate();
  }

  function handleAddItem(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newItemId) return;
    const priceNum = Number.parseFloat(newPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setAddItemPriceError(null);
      toast.error("Enter a valid price (number ≥ 0).");
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

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-400">
          Open a price list from the Price lists page.
        </p>
        <Link
          to="/admin/price-lists"
          className="mt-2 inline-flex text-primary-600 hover:underline dark:text-primary-400"
        >
          ← Back to price lists
        </Link>
      </div>
    );
  }

  if (isLoading || !priceList) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{error ? getApiErrorMessage(error) : "Price list not found."}</p>
        </div>
        <Link
          to="/admin/price-lists"
          className="mt-4 inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to price lists
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <PageHeader
        title={`Edit price list: ${priceList.name}`}
        fallbackTo="/admin"
      />

      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <form
          id="pl-form"
          onSubmit={handleSaveList}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label
              htmlFor="pl-name"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Name
            </label>
            <input
              id="pl-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="e.g. Default"
            />
          </div>
          <div>
            <label
              htmlFor="pl-branch"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Branch
            </label>
            <SearchableSelect
              id="pl-branch"
              options={plBranchOptions}
              value={formBranchId}
              onChange={setFormBranchId}
              placeholder="Search branch…"
              className="w-full"
              controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
            />
          </div>
          <div>
            <label
              htmlFor="pl-channel"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Channel (optional)
            </label>
            <input
              id="pl-channel"
              type="text"
              value={formChannel}
              onChange={(e) => setFormChannel(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="e.g. RETAIL"
            />
          </div>
          <div>
            <label
              htmlFor="pl-priority"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Priority
            </label>
            <input
              id="pl-priority"
              type="number"
              min={0}
              value={formPriority}
              onChange={(e) =>
                setFormPriority(Number.parseInt(e.target.value, 10) || 0)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </form>
        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
            />
            Active
          </label>
          <button
            type="submit"
            form="pl-form"
            disabled={submitLoading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Menu item prices
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Add catalog items and set prices. These prices appear on Operator POS.
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
          {catalogItemsLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Loading catalog items…
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              No catalog items yet. Add items in{" "}
              <Link
                to="/admin/items"
                className="font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Catalog → Items
              </Link>{" "}
              first.
            </p>
          ) : unassignedCatalogItems.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              All catalog items already have prices in this list.{" "}
              <Link
                to="/admin/items"
                className="font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Manage items
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px]">
                <label
                  htmlFor="new-item"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Item
                </label>
                <SearchableSelect
                  id="new-item"
                  options={newItemOptions}
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
              <div className="w-28 min-w-[7.5rem]">
                <label
                  htmlFor="new-price"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Price
                </label>
                <input
                  id="new-price"
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
                    addItemPriceError ? "new-price-error" : undefined
                  }
                  className={`w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-700 dark:text-white ${
                    addItemPriceError
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                />
                {addItemPriceError ? (
                  <p
                    id="new-price-error"
                    className="mt-1 max-w-xs text-xs text-red-600 dark:text-red-400"
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
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
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
