import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import {
  addLine,
  updateLineQty,
  removeLine,
  setTableId,
  setOrderType,
  clearCart,
} from "@/store/slices/cartSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import { fetchCategories } from "@/api/categories";
import { fetchItems, fetchItemModifierGroups } from "@/api/items";
import { fetchPriceListItems } from "@/api/priceLists";
import { fetchOperatorTables } from "@/api/tables";
import {
  createSale,
  addSaleLine,
  addTender,
  completeSale,
  completeSaleWithDebt,
  fetchReceiptDetails,
  fetchSale,
} from "@/api/sales";
import { fetchTenderTypes } from "@/api/tenderTypes";
import { getCurrentShift } from "@/api/shifts";
import { fetchPriceLists } from "@/api/priceLists";
import { fetchStockLevels } from "@/api/stockLevels";
import { formatCurrency } from "@/utils/formatCurrency";
import { getItemImageUrl } from "@/utils/itemImage";
import { MenuItemCard } from "@/components/MenuItemCard";
import { ModifierModal } from "@/components/ModifierModal";
import { ReceiptModal } from "@/components/ReceiptModal";
import { getApiErrorMessage } from "@/utils/apiError";
import type { Item } from "@/types/catalog";
import type { CartLine, CartModifier } from "@/store/slices/cartSlice";
import type { ReceiptDetailResponse, Sale, Tender } from "@/types/sales";
import { Minus, Plus, Trash2, CreditCard, X } from "lucide-react";

function usePriceMap(orgId: string | null, priceListId: string | null, token: string | null) {
  const { data: priceItems } = useQuery({
    queryKey: ["priceListItems", orgId, priceListId],
    queryFn: () =>
      priceListId && orgId
        ? fetchPriceListItems(token, orgId, priceListId)
        : Promise.resolve([]),
    enabled: Boolean(orgId && priceListId && token),
  });
  return useMemo(() => {
    const map = new Map<string, number>();
    if (priceItems) {
      for (const p of priceItems) {
        const num = typeof p.price === "number" ? p.price : Number(p.price);
        if (!Number.isNaN(num)) map.set(p.itemId, num);
      }
    }
    return map;
  }, [priceItems]);
}

export function MenuOrderPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const terminalId = useAppSelector(selectTerminalId);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const cartLines = useAppSelector((s) => s.cart.lines);
  const priceListId = useAppSelector((s) => s.cart.priceListId);
  const tableId = useAppSelector((s) => s.cart.tableId);
  const orderType = useAppSelector((s) => s.cart.orderType);
  const priceListsData = useQuery({
    queryKey: ["priceLists", orgId],
    queryFn: () => fetchPriceLists(token, orgId!),
    enabled: Boolean(orgId && token),
  });
  const priceLists = priceListsData?.data?.content ?? [];
  const firstPriceListId = priceLists[0]?.id ?? null;
  const effectivePriceListId =
    priceListId ??
    (branchId
      ? priceLists.find((pl) => pl.branchId === branchId)?.id ?? firstPriceListId
      : firstPriceListId);
  const priceMap = usePriceMap(orgId, effectivePriceListId, token);

  const { data: tables = [] } = useQuery({
    queryKey: ["operatorTables", orgId, branchId],
    queryFn: () => fetchOperatorTables(token, orgId!, branchId!),
    enabled: Boolean(orgId && branchId && token),
  });

  const { data: tenderTypes = [] } = useQuery({
    queryKey: ["tenderTypes", orgId],
    queryFn: () => fetchTenderTypes(token, orgId!),
    enabled: Boolean(orgId && token),
  });
  const cashTenderTypeId = tenderTypes.find((t) => t.code === "CASH")?.id ?? tenderTypes[0]?.id;

  const { data: currentShift } = useQuery({
    queryKey: ["operator-current-shift", orgId, branchId, terminalId],
    queryFn: () => getCurrentShift(token, orgId!, branchId!, terminalId!),
    enabled: Boolean(token && orgId && branchId && terminalId),
  });

  const [saleForPayment, setSaleForPayment] = useState<Sale | null>(null);
  const [addTenderAmount, setAddTenderAmount] = useState<string>("");
  const [addTenderTypeId, setAddTenderTypeId] = useState<string>("");
  const [modifierModalItem, setModifierModalItem] = useState<{
    item: Item;
    price: number;
  } | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<ReceiptDetailResponse | null>(null);

  const createSaleAndLinesMutation = useMutation({
    mutationFn: async () => {
      if (!token || !orgId || !branchId || !terminalId) throw new Error("Missing context");
      const sale = await createSale(token, orgId, branchId, terminalId, {
        customerId: null,
        priceListId: effectivePriceListId,
      });
      for (const line of cartLines) {
        await addSaleLine(token, orgId, branchId, terminalId, sale.id, {
          itemId: line.itemId,
          qty: line.qty,
          unitPriceOverride: line.unitPrice,
          modifiers: line.modifiers.map((m) => ({
            modifierOptionId: m.modifierOptionId,
            qty: m.qty,
          })),
        });
      }
      return fetchSale(token, orgId, branchId, terminalId, sale.id);
    },
    onSuccess: (sale) => {
      dispatch(clearCart());
      setSaleForPayment(sale);
      const total = Number(sale.total) || 0;
      const tendered = (sale.tenders ?? []).reduce(
        (s, t) => s + (Number(t.amount) || 0),
        0
      );
      const remainder = total - tendered;
      setAddTenderAmount(remainder > 0 ? String(remainder) : "");
      setAddTenderTypeId(cashTenderTypeId ?? tenderTypes[0]?.id ?? "");
    },
  });

  const addTenderMutation = useMutation({
    mutationFn: async (args: { tenderTypeId: string; amount: number }) => {
      if (!token || !orgId || !branchId || !terminalId || !saleForPayment) {
        throw new Error("Missing context");
      }
      await addTender(token, orgId, branchId, terminalId, saleForPayment.id, {
        tenderTypeId: args.tenderTypeId,
        amount: args.amount,
        currency: "KES",
      });
      return fetchSale(token, orgId, branchId, terminalId, saleForPayment.id);
    },
    onSuccess: (sale) => {
      setSaleForPayment(sale);
      const tendered = (sale.tenders ?? []).reduce(
        (s, t) => s + (Number(t.amount) || 0),
        0
      );
      const total = Number(sale.total) || 0;
      const remainder = total - tendered;
      setAddTenderAmount(remainder > 0 ? String(remainder) : "");
    },
  });

  const completePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!token || !orgId || !branchId || !terminalId || !saleForPayment) {
        throw new Error("Missing context");
      }
      return completeSale(token, orgId, branchId, terminalId, saleForPayment.id);
    },
    onSuccess: () => {
      dispatch(clearCart());
      setSaleForPayment(null);
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
    },
  });

  const completeWithDebtMutation = useMutation({
    mutationFn: async (body: {
      customerName: string;
      customerPhone?: string;
      dueDate?: string;
    }) => {
      if (!token || !orgId || !branchId || !terminalId || !saleForPayment) {
        throw new Error("Missing context");
      }
      return completeSaleWithDebt(
        token,
        orgId,
        branchId,
        terminalId,
        saleForPayment.id,
        body
      );
    },
    onSuccess: () => {
      dispatch(clearCart());
      setSaleForPayment(null);
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
    },
  });

  const handleCompletePayment = async () => {
    try {
      const sale = await completePaymentMutation.mutateAsync();
      const details = await fetchReceiptDetails(
        token!,
        orgId!,
        branchId!,
        terminalId!,
        sale.id
      );
      setReceiptDetails(details);
    } catch {
      // Error surfaced by mutation
    }
  };

  const handleCompleteWithDebt = async (body: {
    customerName: string;
    customerPhone?: string;
    dueDate?: string;
  }) => {
    try {
      const sale = await completeWithDebtMutation.mutateAsync(body);
      const details = await fetchReceiptDetails(
        token!,
        orgId!,
        branchId!,
        terminalId!,
        sale.id
      );
      setReceiptDetails(details);
    } catch {
      // Error surfaced by mutation
    }
  };

  const totalTendered =
    (saleForPayment?.tenders ?? []).reduce(
      (s, t) => s + (Number(t.amount) || 0),
      0
    );
  const saleTotal = Number(saleForPayment?.total ?? 0) || 0;
  const canComplete = saleForPayment != null && totalTendered >= saleTotal;

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories", orgId],
    queryFn: () => fetchCategories(token, orgId!),
    enabled: Boolean(orgId && token),
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", orgId],
    queryFn: () => fetchItems(token, orgId!, { size: 200 }),
    enabled: Boolean(orgId && token),
  });

  const trackedItemIds = useMemo(
    () =>
      (itemsData?.content ?? [])
        .filter((i: Item) => i.trackInventory)
        .map((i: Item) => i.id),
    [itemsData?.content]
  );

  const { data: stockLevels = [] } = useQuery({
    queryKey: ["stockLevels", orgId, branchId, trackedItemIds.join(",")],
    queryFn: () =>
      fetchStockLevels(token, orgId!, branchId!, trackedItemIds),
    enabled: Boolean(orgId && branchId && token && trackedItemIds.length > 0),
  });

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stockLevels) {
      const qty = typeof s.onHandQty === "number" ? s.onHandQty : Number(s.onHandQty);
      map.set(s.itemId, Number.isNaN(qty) ? 0 : qty);
    }
    return map;
  }, [stockLevels]);

  const categories = categoriesData?.content ?? [];
  const items = useMemo(() => {
    const list = itemsData?.content ?? [];
    if (!selectedCategoryId) return list;
    return list.filter((i: Item) => i.categoryId === selectedCategoryId);
  }, [itemsData?.content, selectedCategoryId]);

  const itemMap = useMemo(() => {
    const map = new Map<string, Item>();
    for (const i of itemsData?.content ?? []) {
      map.set(i.id, i);
    }
    return map;
  }, [itemsData?.content]);

  const { hasInsufficientStock, insufficientStockMessage } = useMemo(() => {
    const seen = new Set<string>();
    const msgs: string[] = [];
    for (const line of cartLines) {
      if (seen.has(line.itemId)) continue;
      const item = itemMap.get(line.itemId);
      if (!item?.trackInventory) continue;
      seen.add(line.itemId);
      const onHand = stockMap.get(line.itemId) ?? 0;
      const qtyInCartForItem = cartLines
        .filter((l) => l.itemId === line.itemId)
        .reduce((s, l) => s + l.qty, 0);
      if (onHand < qtyInCartForItem) {
        msgs.push(`${item.name}: ${onHand} in stock, ${qtyInCartForItem} needed`);
      }
    }
    return {
      hasInsufficientStock: msgs.length > 0,
      insufficientStockMessage: msgs[0] ?? "Hakuna stock ya kutosha",
    };
  }, [cartLines, itemMap, stockMap]);

  const cartSubtotal = useMemo(() => {
    return cartLines.reduce(
      (sum, line) => sum + line.unitPrice * line.qty + line.modifiers.reduce((m, mod) => m + mod.unitPriceDelta * mod.qty, 0),
      0
    );
  }, [cartLines]);
  const total = cartSubtotal;

  const handleAddToCart = async (item: Item) => {
    const price = priceMap.get(item.id) ?? 0;
    const links =
      orgId && token
        ? await fetchItemModifierGroups(token, orgId, item.id)
        : [];
    if (links.length === 0) {
      dispatch(
        addLine({
          itemId: item.id,
          itemName: item.name,
          primaryImageUrl: item.primaryImageUrl,
          qty: 1,
          unitPrice: price,
        })
      );
    } else {
      setModifierModalItem({ item, price });
    }
  };

  const handleReduceFromCart = (itemId: string) => {
    const line = cartLines.find(
      (l) => l.itemId === itemId && (l.modifiers?.length ?? 0) === 0
    );
    if (!line) return;
    if (line.qty <= 1) {
      dispatch(removeLine(line.tempId));
    } else {
      dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty - 1 }));
    }
  };

  const getQtyInCart = (itemId: string) =>
    cartLines
      .filter((l) => l.itemId === itemId)
      .reduce((s, l) => s + l.qty, 0);

  const handleModifierConfirm = (modifiers: CartModifier[]) => {
    if (!modifierModalItem) return;
    dispatch(
      addLine({
        itemId: modifierModalItem.item.id,
        itemName: modifierModalItem.item.name,
        primaryImageUrl: modifierModalItem.item.primaryImageUrl,
        qty: 1,
        unitPrice: modifierModalItem.price,
        modifiers,
      })
    );
    setModifierModalItem(null);
  };

  return (
    <>
    <div className="flex h-full min-h-0 touch-manipulation flex-col lg:flex-row">
      {/* Main content: categories + item grid */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <h2 className="mb-2 shrink-0 text-lg font-semibold text-slate-900 dark:text-white">
          Dish Menu
        </h2>
        <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className={`min-h-[28px] min-w-0 touch-manipulation rounded-md px-2 py-1.5 text-xs font-medium transition ${
              selectedCategoryId === null
                ? "bg-primary-600 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            All ({itemsData?.totalElements ?? 0})
          </button>
          {categoriesLoading
            ? null
            : categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`min-h-[28px] min-w-0 touch-manipulation rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    selectedCategoryId === cat.id
                      ? "bg-primary-600 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                >
                  {cat.name} (
                  {itemsData?.content?.filter((i: Item) => i.categoryId === cat.id).length ?? 0})
                </button>
              ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {itemsLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-600"
                >
                  <div className="h-[84px] animate-pulse rounded-t-lg bg-slate-200 dark:bg-slate-700" />
                  <div className="h-10 animate-pulse rounded-b-lg bg-slate-100 dark:bg-slate-700/50" />
                </div>
              ))
            : items.map((item: Item) => {
                const onHand = item.trackInventory
                  ? (stockMap.get(item.id) ?? 0)
                  : Infinity;
                const price = priceMap.get(item.id) ?? 0;
                return (
                  <MenuItemCard
                    key={item.id}
                    name={item.name}
                    itemId={item.id}
                    primaryImageUrl={item.primaryImageUrl}
                    trackInventory={item.trackInventory}
                    active={item.active}
                    stockOnHand={onHand}
                    price={price}
                    quantityInCart={getQtyInCart(item.id)}
                    onReduce={() => handleReduceFromCart(item.id)}
                    onAdd={() => handleAddToCart(item)}
                  />
                );
              })}
          </div>
        </div>
      </div>

      {/* Order summary sidebar */}
      <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-slate-200 bg-white lg:w-96 lg:border-l lg:border-t-0 dark:border-slate-700 dark:bg-slate-800/80">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <div className="mb-2 shrink-0 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Order Summary
            </h2>
            <span className="text-sm text-slate-500">#—</span>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden">
            {cartLines.length === 0 ? (
              <p className="py-4 text-center text-slate-500">No items yet</p>
            ) : (
              cartLines.map((line: CartLine) => (
                <OrderLineRow key={line.tempId} line={line} />
              ))
            )}
          </div>
          <div className="mt-1 shrink-0 space-y-0.5 border-t border-slate-200 pt-1.5 text-sm dark:border-slate-600">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span>{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-900 dark:text-white">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="mt-1.5 shrink-0 flex flex-col gap-2">
            <select
              value={orderType}
              onChange={(e) =>
                dispatch(
                  setOrderType(e.target.value as "DINE_IN" | "TAKEAWAY" | "DELIVERY")
                )
              }
              className="min-h-[48px] touch-manipulation rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              aria-label="Order type"
            >
              <option value="DINE_IN">Dine-in</option>
              <option value="TAKEAWAY">Takeaway</option>
              <option value="DELIVERY">Delivery</option>
            </select>
            <select
              value={tableId ?? ""}
              onChange={(e) =>
                dispatch(setTableId(e.target.value || null))
              }
              className="min-h-[48px] touch-manipulation rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              aria-label="Select table"
            >
              <option value="">Select table</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        <button
          type="button"
          disabled={
            cartLines.length === 0 ||
            createSaleAndLinesMutation.isPending ||
            !currentShift ||
            tenderTypes.length === 0 ||
            hasInsufficientStock
          }
          onClick={() => createSaleAndLinesMutation.mutate()}
          className="mt-1.5 shrink-0 min-h-[48px] w-full touch-manipulation rounded-xl bg-primary-600 py-3 text-lg font-semibold text-white transition hover:bg-primary-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-primary-500"
        >
          {createSaleAndLinesMutation.isPending ? "Processing…" : "Proceed to payment"}
        </button>
        {!currentShift && orgId && branchId && terminalId && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400" role="status">
            Open a shift on the Dashboard first to accept payments.
          </p>
        )}
        {currentShift && tenderTypes.length === 0 && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400" role="status">
            No payment method configured. Add a Cash tender type in Admin.
          </p>
        )}
        {hasInsufficientStock && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400" role="status">
            {insufficientStockMessage}
          </p>
        )}
        {createSaleAndLinesMutation.isError && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {getApiErrorMessage(createSaleAndLinesMutation.error)}
          </p>
        )}
        </div>
      </aside>

      {saleForPayment && (
        <PaymentModal
          sale={saleForPayment}
          tenderTypes={tenderTypes}
          totalTendered={totalTendered}
          canComplete={canComplete}
          addTenderAmount={addTenderAmount}
          setAddTenderAmount={setAddTenderAmount}
          addTenderTypeId={addTenderTypeId}
          setAddTenderTypeId={setAddTenderTypeId}
          onAddTender={() => {
            const amt = parseFloat(addTenderAmount);
            if (!Number.isNaN(amt) && amt > 0 && addTenderTypeId) {
              addTenderMutation.mutate({ tenderTypeId: addTenderTypeId, amount: amt });
            }
          }}
          onComplete={handleCompletePayment}
          onCompleteWithDebt={handleCompleteWithDebt}
          onClose={() => setSaleForPayment(null)}
          isAddingTender={addTenderMutation.isPending}
          isCompleting={completePaymentMutation.isPending}
          isCompletingWithDebt={completeWithDebtMutation.isPending}
          addTenderError={addTenderMutation.isError ? getApiErrorMessage(addTenderMutation.error) : null}
          completeError={
            completePaymentMutation.isError ? getApiErrorMessage(completePaymentMutation.error) : null
          }
          completeWithDebtError={
            completeWithDebtMutation.isError
              ? getApiErrorMessage(completeWithDebtMutation.error)
              : null
          }
        />
      )}
    </div>
      {modifierModalItem && orgId && (
        <ModifierModal
          item={modifierModalItem.item}
          unitPrice={modifierModalItem.price}
          orgId={orgId}
          token={token}
          onConfirm={handleModifierConfirm}
          onClose={() => setModifierModalItem(null)}
        />
      )}
      {receiptDetails && (
        <ReceiptModal
          receipt={receiptDetails}
          onClose={() => setReceiptDetails(null)}
          shopName={branchName ?? ""}
        />
      )}
    </>
  );
}

function PaymentModal({
  sale,
  tenderTypes,
  totalTendered,
  canComplete,
  addTenderAmount,
  setAddTenderAmount,
  addTenderTypeId,
  setAddTenderTypeId,
  onAddTender,
  onComplete,
  onCompleteWithDebt,
  onClose,
  isAddingTender,
  isCompleting,
  isCompletingWithDebt,
  addTenderError,
  completeError,
  completeWithDebtError,
}: {
  sale: Sale;
  tenderTypes: { id: string; code: string; name: string }[];
  totalTendered: number;
  canComplete: boolean;
  addTenderAmount: string;
  setAddTenderAmount: (v: string) => void;
  addTenderTypeId: string;
  setAddTenderTypeId: (v: string) => void;
  onAddTender: () => void;
  onComplete: () => void;
  onCompleteWithDebt?: (body: {
    customerName: string;
    customerPhone?: string;
    dueDate?: string;
  }) => void;
  onClose: () => void;
  isAddingTender: boolean;
  isCompleting: boolean;
  isCompletingWithDebt?: boolean;
  addTenderError: string | null;
  completeError: string | null;
  completeWithDebtError?: string | null;
}) {
  const total = Number(sale.total) || 0;
  const remainder = total - totalTendered;
  const [debtCustomerName, setDebtCustomerName] = useState("");
  const [debtCustomerPhone, setDebtCustomerPhone] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2
            id="payment-modal-title"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"
          >
            <CreditCard className="h-5 w-5" />
            Manage payments
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-700/50">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Total due</span>
              <span className="tabular-nums font-semibold">{formatCurrency(total)}</span>
            </div>
            <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-300">
              <span>Tendered</span>
              <span className="tabular-nums font-semibold">{formatCurrency(totalTendered)}</span>
            </div>
            {remainder > 0 && (
              <div className="mt-1 flex justify-between text-amber-600 dark:text-amber-400">
                <span>Remaining</span>
                <span className="tabular-nums font-semibold">{formatCurrency(remainder)}</span>
              </div>
            )}
            {remainder <= 0 && totalTendered > 0 && (
              <div className="mt-1 flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Change</span>
                <span className="tabular-nums font-semibold">
                  {formatCurrency(-remainder)}
                </span>
              </div>
            )}
          </div>

          {sale.tenders && sale.tenders.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Payments added
              </h3>
              <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/30">
                {sale.tenders.map((t: Tender) => (
                  <li
                    key={t.id}
                    className="flex justify-between text-sm text-slate-800 dark:text-white"
                  >
                    <span>{t.tenderTypeCode ?? "—"}</span>
                    <span className="tabular-nums">{formatCurrency(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Add payment
            </h3>
            <div className="flex gap-2">
              <select
                value={addTenderTypeId}
                onChange={(e) => setAddTenderTypeId(e.target.value)}
                className="min-h-[48px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                aria-label="Payment type"
              >
                {tenderTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={addTenderAmount}
                onChange={(e) => setAddTenderAmount(e.target.value)}
                placeholder="Amount"
                className="min-h-[48px] w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-right tabular-nums text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                aria-label="Amount"
              />
              <button
                type="button"
                disabled={
                  isAddingTender ||
                  !addTenderTypeId ||
                  !addTenderAmount ||
                  parseFloat(addTenderAmount) <= 0
                }
                onClick={onAddTender}
                className="min-h-[48px] shrink-0 rounded-xl bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAddingTender ? "…" : "Add"}
              </button>
            </div>
            {addTenderError && (
              <p className="mt-2 text-sm text-red-400" role="alert">
                {addTenderError}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-600">
          {remainder > 0 && totalTendered > 0 && onCompleteWithDebt ? (
            <>
              <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Record balance as debt
              </h3>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Capture customer details to record {formatCurrency(remainder)} as debt.
              </p>
              <div className="mb-3 space-y-2">
                <input
                  type="text"
                  required
                  value={debtCustomerName}
                  onChange={(e) => setDebtCustomerName(e.target.value)}
                  placeholder="Customer name *"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  aria-label="Customer name"
                />
                <input
                  type="tel"
                  value={debtCustomerPhone}
                  onChange={(e) => setDebtCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  aria-label="Customer phone"
                />
                <input
                  type="date"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  aria-label="Due date"
                />
              </div>
              <button
                type="button"
                disabled={
                  !debtCustomerName.trim() || isCompletingWithDebt || isCompleting
                }
                onClick={() =>
                  onCompleteWithDebt({
                    customerName: debtCustomerName.trim(),
                    customerPhone: debtCustomerPhone.trim() || undefined,
                    dueDate: debtDueDate || undefined,
                  })
                }
                className="min-h-[48px] w-full rounded-xl bg-amber-600 py-3 text-lg font-semibold text-white transition hover:bg-amber-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-amber-500"
              >
                {isCompletingWithDebt ? "Processing…" : "Complete with balance as debt"}
              </button>
              {completeWithDebtError && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {completeWithDebtError}
                </p>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!canComplete || isCompleting}
                onClick={onComplete}
                className="min-h-[48px] w-full rounded-xl bg-emerald-600 py-3 text-lg font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-emerald-500"
              >
                {isCompleting ? "Completing…" : "Complete sale"}
              </button>
              {completeError && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {completeError}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderLineRow({ line }: { line: CartLine }) {
  const dispatch = useAppDispatch();
  const lineTotal =
    line.unitPrice * line.qty +
    line.modifiers.reduce((s, m) => s + m.unitPriceDelta * m.qty, 0);

  const handleReduce = () => {
    if (line.qty <= 1) {
      dispatch(removeLine(line.tempId));
    } else {
      dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty - 1 }));
    }
  };

  const handleAdd = () => {
    dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty + 1 }));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-slate-100 p-4 dark:bg-slate-700/50">
      <div className="flex gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-600">
          {line.primaryImageUrl ? (
            <img
              src={getItemImageUrl(line.primaryImageUrl) ?? line.primaryImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              —
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900 dark:text-white">
            {line.itemName}
          </p>
          {line.modifiers.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {line.modifiers.map((m) => `${m.modifierOptionName} × ${m.qty}`).join(", ")}
            </p>
          )}
          <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
            {formatCurrency(lineTotal)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex touch-manipulation items-center rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700">
          <button
            type="button"
            onClick={handleReduce}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-l-xl text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:text-slate-200 dark:hover:bg-slate-600"
            aria-label={`Reduce quantity of ${line.itemName}`}
          >
            <Minus className="h-6 w-6" />
          </button>
          <span
            className="min-w-[2.5rem] px-2 text-center text-lg font-semibold tabular-nums text-slate-900 dark:text-white"
            aria-live="polite"
          >
            {line.qty}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-r-xl text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:text-slate-200 dark:hover:bg-slate-600"
            aria-label={`Increase quantity of ${line.itemName}`}
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => dispatch(removeLine(line.tempId))}
          className="flex min-h-[48px] min-w-[48px] touch-manipulation items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-100 hover:text-red-700 active:scale-95 dark:text-slate-400 dark:hover:bg-red-600/30 dark:hover:text-red-300"
          aria-label={`Remove ${line.itemName} from order`}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
