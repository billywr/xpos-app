import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import {
  addLine,
  updateLineQty,
  removeLine,
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
import { fetchItems, fetchItemByBarcode, fetchItemModifierGroups } from "@/api/items";
import { fetchOperatorTables } from "@/api/tables";
import {
  fetchMpesaOperatorSettings,
} from "@/api/mpesa";
import {
  createSale,
  addSaleLine,
  addTender,
  removeTender,
  completeSale,
  completeSaleWithDebt,
  fetchReceiptDetails,
  fetchSale,
} from "@/api/sales";
import { fetchTenderTypes } from "@/api/tenderTypes";
import { getCurrentShift } from "@/api/shifts";
import { fetchStockLevels } from "@/api/stockLevels";
import { invalidateInventoryQueries } from "@/utils/invalidateInventoryQueries";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatQty } from "@/utils/formatQuantity";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CountBadge } from "@/components/ui";
import { ModifierModal } from "@/components/ModifierModal";
import { ReceiptModal } from "@/components/ReceiptModal";
import { getApiErrorMessage } from "@/utils/apiError";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import {
  MENU_ORDER_SHOW_ORDER_TYPE,
  MENU_ORDER_SHOW_TABLE_SELECT,
  MENU_ORDER_SHOW_ITEM_LIST,
  MENU_ORDER_SHOW_HIDE_OOS,
  isMenuOrderOptionVisible,
} from "@/config/menuOrderVisibility";
import { BARCODE_MENU_ORDER, isBarcodeVisible } from "@/config/barcodeVisibility";
import { isPosExpandedByDefault } from "@/config/posAppearanceSettings";
import { PosCartTicket } from "./components/PosCartTicket";
import { PosPaymentModal } from "./components/PosPaymentModal";
import type { Item } from "@/types/catalog";
import type { CartModifier } from "@/store/slices/cartSlice";
import type { ReceiptDetailResponse, Sale } from "@/types/sales";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  ShoppingCart,
  ArrowLeft,
} from "lucide-react";

const GRID_PAGE_SIZE = 24;

function isItemOutOfStock(item: Item, stockMap: Map<string, number>): boolean {
  if (!item.trackInventory) {
    return false;
  }
  const onHand = stockMap.get(item.id) ?? 0;
  return onHand <= 0;
}

function filterOutOfStockItems(
  list: Item[],
  stockMap: Map<string, number>,
  hideOutOfStock: boolean
): Item[] {
  if (!hideOutOfStock) {
    return list;
  }
  return list.filter((i) => !isItemOutOfStock(i, stockMap));
}

export function MenuOrderPage() {
  const location = useLocation();
  const fallbackTo = location.pathname.startsWith("/admin") ? "/admin" : "/operator";
  const [searchParams, setSearchParams] = useSearchParams();
  const saleIdFromUrl = searchParams.get("saleId");
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const terminalId = useAppSelector(selectTerminalId);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [hideOutOfStock, setHideOutOfStock] = useState(true);
  const [gridPage, setGridPage] = useState(0);
  const navContext = useNavVisibilityContextOrNull();
  const adminLabels = navContext?.adminLabels;
  const operatorVisibility = navContext?.operatorVisibility ?? {};

  const isDefaultExpanded = isPosExpandedByDefault(adminLabels);
  const [posExpanded, setPosExpanded] = useState<boolean>(() =>
    isPosExpandedByDefault(adminLabels)
  );
  const userHasToggledRef = useRef(false);

  // Clear legacy persisted key so it does not hijack the default behavior
  useEffect(() => {
    try {
      localStorage.removeItem("pos_expanded");
    } catch {
      // Ignore
    }
  }, []);

  // Sync with default if it arrives/updates asynchronously and user has not interacted
  useEffect(() => {
    if (!userHasToggledRef.current) {
      setPosExpanded(isDefaultExpanded);
    }
  }, [isDefaultExpanded]);

  // Listen to cross-component settings updates
  useEffect(() => {
    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ expanded: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.expanded === "boolean") {
        userHasToggledRef.current = false;
        setPosExpanded(customEvent.detail.expanded);
      }
    };
    window.addEventListener("pos-expanded-default-changed", handleConfigChange);
    return () => {
      window.removeEventListener("pos-expanded-default-changed", handleConfigChange);
    };
  }, []);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const showOrderType = isMenuOrderOptionVisible(
    operatorVisibility,
    MENU_ORDER_SHOW_ORDER_TYPE
  );
  const showTableSelect = isMenuOrderOptionVisible(
    operatorVisibility,
    MENU_ORDER_SHOW_TABLE_SELECT
  );
  const showItemList = isMenuOrderOptionVisible(
    operatorVisibility,
    MENU_ORDER_SHOW_ITEM_LIST
  );
  const showHideOosToggle = isMenuOrderOptionVisible(
    operatorVisibility,
    MENU_ORDER_SHOW_HIDE_OOS
  );
  const showBarcode = isBarcodeVisible(operatorVisibility, BARCODE_MENU_ORDER);

  const cartLines = useAppSelector((s) => s.cart.lines);
  const tableId = useAppSelector((s) => s.cart.tableId);
  const orderType = useAppSelector((s) => s.cart.orderType);

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

  const { data: mpesaOperatorSettings } = useQuery({
    queryKey: ["mpesa-operator-settings", orgId],
    queryFn: () => fetchMpesaOperatorSettings(token, orgId!),
    enabled: Boolean(orgId && token),
  });
  const mpesaStkEnabled = mpesaOperatorSettings?.stkOperatorEnabled ?? false;
  const cashTenderTypeId = tenderTypes.find((t) => t.code === "CASH")?.id ?? tenderTypes[0]?.id;

  const operatorTableSelectOptions = useMemo(
    () => [
      { value: "", label: "Select table" },
      ...tables.map((t) => ({ value: t.id, label: t.name })),
    ],
    [tables]
  );

  const { data: currentShift } = useQuery({
    queryKey: ["operator-current-shift", orgId, branchId, terminalId],
    queryFn: () => getCurrentShift(token, orgId!, branchId!, terminalId!),
    enabled: Boolean(token && orgId && branchId && terminalId),
  });

  const [saleForPayment, setSaleForPayment] = useState<Sale | null>(null);
  const [addTenderAmount, setAddTenderAmount] = useState<string>("");
  const [addTenderTypeId, setAddTenderTypeId] = useState<string>("");

  const { data: saleFromUrl } = useQuery({
    queryKey: ["sale", token, orgId, branchId, terminalId, saleIdFromUrl],
    queryFn: () =>
      fetchSale(token!, orgId!, branchId!, terminalId!, saleIdFromUrl!),
    enabled: Boolean(
      saleIdFromUrl && token && orgId && branchId && terminalId
    ),
  });

  useEffect(() => {
    if (saleFromUrl && saleIdFromUrl) {
      const isOpenOrHeld =
        saleFromUrl.status === "OPEN" || saleFromUrl.status === "HELD";
      if (isOpenOrHeld) {
        setSaleForPayment(saleFromUrl);
        const total = Number(saleFromUrl.total) || 0;
        const tendered = (saleFromUrl.tenders ?? []).reduce(
          (sum, t) => sum + (Number(t.amount) || 0),
          0
        );
        const remainder = total - tendered;
        setAddTenderAmount(remainder > 0 ? String(remainder) : "");
        setAddTenderTypeId(cashTenderTypeId ?? tenderTypes[0]?.id ?? "");
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("saleId");
        return next;
      });
    }
  }, [saleFromUrl, saleIdFromUrl, cashTenderTypeId, tenderTypes, setSearchParams]);

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

  const removeTenderMutation = useMutation({
    mutationFn: async (tenderId: string) => {
      if (!token || !orgId || !branchId || !terminalId || !saleForPayment) {
        throw new Error("Missing context");
      }
      await removeTender(
        token,
        orgId,
        branchId,
        terminalId,
        saleForPayment.id,
        tenderId
      );
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
      setAddTenderTypeId(cashTenderTypeId ?? tenderTypes[0]?.id ?? "");
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
      void invalidateInventoryQueries(queryClient);
      void queryClient.refetchQueries({ queryKey: ["stockLevels"] });
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts-pending-total"] });
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
      void invalidateInventoryQueries(queryClient);
      void queryClient.refetchQueries({ queryKey: ["stockLevels"] });
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts-pending-total"] });
    },
  });

  const handleStkAutoCompleted = async () => {
    if (!token || !orgId || !branchId || !terminalId || !saleForPayment) {
      return;
    }
    try {
      const details = await fetchReceiptDetails(
        token,
        orgId,
        branchId,
        terminalId,
        saleForPayment.id
      );
      dispatch(clearCart());
      setSaleForPayment(null);
      setReceiptDetails(details);
      void invalidateInventoryQueries(queryClient);
      void queryClient.refetchQueries({ queryKey: ["stockLevels"] });
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts-pending-total"] });
    } catch {
      // Sale may still be open if auto-complete disabled; user can complete manually
    }
  };

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

  const catalogItemsForPos = useMemo(() => {
    const raw = itemsData?.content ?? [];
    return raw.filter(
      (i) =>
        (i.defaultSellingPrice ?? 0) > 0 && i.visibleInPos !== false
    );
  }, [itemsData?.content]);

  const trackedItemIds = useMemo(
    () =>
      catalogItemsForPos
        .filter((i: Item) => i.trackInventory)
        .map((i: Item) => i.id),
    [catalogItemsForPos]
  );

  const { data: stockLevels = [] } = useQuery({
    queryKey: ["stockLevels", orgId, branchId, trackedItemIds.join(",")],
    queryFn: () =>
      fetchStockLevels(token, orgId!, branchId!, trackedItemIds),
    enabled: Boolean(orgId && branchId && token && trackedItemIds.length > 0),
    refetchOnWindowFocus: true,
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

  // Filter items by category, search query, and stock visibility
  const items = useMemo(() => {
    let list = catalogItemsForPos;
    if (selectedCategoryId !== null) {
      list = list.filter((i: Item) => i.categoryId === selectedCategoryId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i: Item) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku && i.sku.toLowerCase().includes(q)) ||
          (i.barcode && i.barcode.toLowerCase().includes(q))
      );
    }
    return filterOutOfStockItems(list, stockMap, hideOutOfStock);
  }, [catalogItemsForPos, selectedCategoryId, searchQuery, stockMap, hideOutOfStock]);

  // Reset grid page when filters change
  useEffect(() => {
    setGridPage(0);
  }, [selectedCategoryId, searchQuery, hideOutOfStock]);

  const gridTotalPages = Math.max(1, Math.ceil(items.length / GRID_PAGE_SIZE));
  const pagedItems = useMemo(
    () => items.slice(gridPage * GRID_PAGE_SIZE, (gridPage + 1) * GRID_PAGE_SIZE),
    [items, gridPage]
  );

  const visibleCountForCategory = useCallback(
    (categoryId: string | null) => {
      const base =
        categoryId === null
          ? catalogItemsForPos
          : catalogItemsForPos.filter((i: Item) => i.categoryId === categoryId);
      return filterOutOfStockItems(base, stockMap, hideOutOfStock).length;
    },
    [catalogItemsForPos, stockMap, hideOutOfStock]
  );

  const canSellOnPos = useCallback(
    (item: Item) =>
      item.active && (item.defaultSellingPrice ?? 0) > 0 && item.visibleInPos !== false,
    []
  );

  const [scannedItemsForCart, setScannedItemsForCart] = useState<Item[]>([]);
  const [barcodeScanError, setBarcodeScanError] = useState<string | null>(null);

  const itemMap = useMemo(() => {
    const map = new Map<string, Item>();
    for (const i of itemsData?.content ?? []) {
      map.set(i.id, i);
    }
    for (const i of scannedItemsForCart) {
      if (!map.has(i.id)) map.set(i.id, i);
    }
    return map;
  }, [itemsData?.content, scannedItemsForCart]);

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
        msgs.push(
          `${item.name}: ${formatQty(onHand)} in stock, ${formatQty(qtyInCartForItem)} needed`
        );
      }
    }
    return {
      hasInsufficientStock: msgs.length > 0,
      insufficientStockMessage: msgs[0] ?? "Insufficient stock available",
    };
  }, [cartLines, itemMap, stockMap]);

  const cartSubtotal = useMemo(() => {
    return cartLines.reduce(
      (sum, line) =>
        sum +
        line.unitPrice * line.qty +
        line.modifiers.reduce((m, mod) => m + mod.unitPriceDelta * mod.qty, 0),
      0
    );
  }, [cartLines]);
  const total = cartSubtotal;

  const handleAddToCart = useCallback(
    async (item: Item): Promise<boolean> => {
      if (!canSellOnPos(item)) {
        return false;
      }
      const price = item.defaultSellingPrice ?? 0;
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
        return false;
      }
      setModifierModalItem({ item, price });
      return true;
    },
    [canSellOnPos, orgId, token, dispatch]
  );

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!token || !orgId || !barcode.trim()) return;
      setBarcodeScanError(null);
      try {
        const item = await fetchItemByBarcode(token, orgId, barcode.trim());
        if (!canSellOnPos(item)) {
          setBarcodeScanError("Item is not on this branch menu.");
          return;
        }
        setScannedItemsForCart((prev) =>
          prev.some((i) => i.id === item.id) ? prev : [...prev, item]
        );
        const openedModifierModal = await handleAddToCart(item);
        if (openedModifierModal) setBarcodeScanError(null);
      } catch (err) {
        setBarcodeScanError(getApiErrorMessage(err));
      }
    },
    [token, orgId, canSellOnPos, handleAddToCart]
  );

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
      <div
        className={`flex touch-manipulation flex-col lg:flex-row ${
          posExpanded
            ? "fixed inset-0 z-40 bg-slate-50 dark:bg-slate-900"
            : "h-full min-h-0 bg-slate-50 dark:bg-slate-900"
        }`}
      >
        {/* CENTER WORKSPACE: Catalog, Search, Categories & Product Grid */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 pb-20 lg:pb-4">
          {/* Top Bar: Navigation Header & Search Bar */}
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                to={fallbackTo}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-black text-slate-900 leading-tight dark:text-white">
                  POS
                </h1>
                <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
                  Select items and complete sale
                </p>
              </div>
            </div>

            {/* Persistent Prominent Search Bar */}
            <div className="flex flex-1 items-center justify-end gap-2 min-w-[260px]">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name or code..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400"
                  aria-label="Search products"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 active:scale-90 dark:hover:text-slate-200"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Fullscreen Expand Button */}
              <button
                type="button"
                onClick={() => {
                  userHasToggledRef.current = true;
                  setPosExpanded((v) => !v);
                }}
                className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-2xs"
                title={posExpanded ? "Exit full screen" : "Expand full screen"}
                aria-label={posExpanded ? "Exit full screen" : "Expand full screen"}
              >
                {posExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {showItemList ? (
            <>
              {/* Category Strip & Stock Toggle */}
              <div className="mb-2 flex shrink-0 items-center justify-between gap-1.5 sm:gap-2">
                <div className="flex flex-1 items-center gap-1 sm:gap-1.5 overflow-x-auto scroll-smooth pb-0.5 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className={`min-h-[28px] sm:min-h-[30px] shrink-0 touch-manipulation rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-0.5 text-sm sm:text-base font-bold transition inline-flex items-center gap-1 sm:gap-1.5 ${
                      selectedCategoryId === null
                        ? "bg-primary-600 text-white font-extrabold shadow-xs dark:bg-primary-500"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>All</span>
                    <CountBadge
                      count={visibleCountForCategory(null)}
                      variant={selectedCategoryId === null ? "primary" : "neutral"}
                      active={selectedCategoryId === null}
                      className={selectedCategoryId === null ? "bg-white/20 text-white" : ""}
                    />
                  </button>
                  {categoriesLoading
                    ? null
                    : categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`min-h-[28px] sm:min-h-[30px] shrink-0 touch-manipulation rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-0.5 text-sm sm:text-base font-bold transition inline-flex items-center gap-1 sm:gap-1.5 ${
                            selectedCategoryId === cat.id
                              ? "bg-primary-600 text-white font-extrabold shadow-xs dark:bg-primary-500"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          <span>{cat.name}</span>
                          <CountBadge
                            count={visibleCountForCategory(cat.id)}
                            variant={selectedCategoryId === cat.id ? "primary" : "neutral"}
                            active={selectedCategoryId === cat.id}
                            className={selectedCategoryId === cat.id ? "bg-white/20 text-white" : ""}
                          />
                        </button>
                      ))}
                </div>

                {showHideOosToggle && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hideOutOfStock}
                    onClick={() => setHideOutOfStock((v) => !v)}
                    className={`flex min-h-[28px] sm:min-h-[30px] shrink-0 touch-manipulation items-center gap-1 rounded-lg border px-2 py-0.5 sm:px-2.5 sm:py-0.5 text-xs sm:text-sm font-semibold transition active:scale-95 ${
                      hideOutOfStock
                        ? "border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-500/50 dark:bg-primary-950/40 dark:text-primary-300"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                    title={
                      hideOutOfStock
                        ? "Out-of-stock items are hidden. Click to show them."
                        : "All items shown. Click to hide out-of-stock."
                    }
                  >
                    {hideOutOfStock ? (
                      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="hidden sm:inline">
                      {hideOutOfStock ? "Show OOS" : "Hide OOS"}
                    </span>
                  </button>
                )}
              </div>

              {/* Product Grid Container */}
              <div className="pos-grid-container min-h-0 flex-1 overflow-auto p-1 sm:p-1.5 pr-1.5 sm:pr-2 pb-4">
                {/* Grid */}
                <div className="pos-product-grid">
                  {itemsLoading
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-xs"
                        >
                          <div className="aspect-[16/10] w-full animate-pulse bg-slate-200 dark:bg-slate-700" />
                          <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="h-6 w-3/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                              <div className="h-6 w-1/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="h-11 sm:h-12 -mx-1 sm:-mx-1.5 w-[calc(100%+0.5rem)] sm:w-[calc(100%+0.75rem)] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/60" />
                          </div>
                        </div>
                      ))
                    : pagedItems.length === 0 ? (
                      <div className="col-span-full py-16 text-center">
                        <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
                          {searchQuery
                            ? `No products found matching "${searchQuery}"`
                            : "No items available in this category"}
                        </p>
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="mt-3 inline-flex items-center rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-500 dark:bg-primary-600 dark:hover:bg-primary-500"
                          >
                            Clear search filter
                          </button>
                        )}
                      </div>
                    ) : (
                      pagedItems.map((item: Item) => {
                        const onHand = item.trackInventory
                            ? (stockMap.get(item.id) ?? 0)
                          : Infinity;
                        const price = item.defaultSellingPrice ?? 0;
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
                      })
                    )}
                </div>

                {/* Pagination Footer */}
                {!itemsLoading && items.length > GRID_PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {gridPage * GRID_PAGE_SIZE + 1}–
                      {Math.min((gridPage + 1) * GRID_PAGE_SIZE, items.length)} of {items.length} products
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={gridPage === 0}
                        onClick={() => setGridPage((p) => p - 1)}
                        className="flex h-8 touch-manipulation items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Prev</span>
                      </button>
                      <span className="min-w-[3rem] text-center font-bold">
                        {gridPage + 1} / {gridTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={gridPage >= gridTotalPages - 1}
                        onClick={() => setGridPage((p) => p + 1)}
                        className="flex h-8 touch-manipulation items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <span>Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Item list is hidden. Change in Admin → Settings → POS.
            </p>
          )}
        </div>

        {/* RIGHT WORKSPACE: Persistent Dining Check / Order Ticket (Approx 30% width) */}
        <aside className="hidden min-h-0 max-h-full lg:w-[30%] xl:w-[30%] min-w-[360px] max-w-[480px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white lg:flex dark:border-slate-700 dark:bg-slate-800 shadow-sm">
          <PosCartTicket
            showBarcode={showBarcode}
            handleBarcodeScan={handleBarcodeScan}
            token={token}
            orgId={orgId}
            barcodeScanError={barcodeScanError}
            cartLines={cartLines}
            itemMap={itemMap}
            stockMap={stockMap}
            total={total}
            showOrderType={showOrderType}
            orderType={orderType}
            showTableSelect={showTableSelect}
            operatorTableSelectOptions={operatorTableSelectOptions}
            tableId={tableId}
            createSaleAndLinesMutation={createSaleAndLinesMutation}
            currentShift={currentShift}
            tenderTypes={tenderTypes}
            hasInsufficientStock={hasInsufficientStock}
            insufficientStockMessage={insufficientStockMessage}
          />
        </aside>

        {/* Mobile Floating Cart Action Bar */}
        {cartLines.length > 0 && !mobileCartOpen && (
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-primary-600 px-5 py-3.5 shadow-xl transition active:scale-[0.98] lg:hidden dark:bg-primary-600"
          >
            <span className="flex items-center gap-2 text-white">
              <ShoppingCart className="h-5 w-5" />
              <span className="text-sm font-bold">Current order</span>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white text-primary-700 text-xs font-bold px-1.5 shadow-xs dark:bg-slate-900 dark:text-primary-300">
                {cartLines.reduce((s, l) => s + l.qty, 0)}
              </span>
            </span>
            <span className="text-base font-black text-white">
              {formatCurrency(total)}
            </span>
          </button>
        )}

        {/* Mobile Full-Screen Cart Overlay */}
        {mobileCartOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden dark:bg-slate-800">
            <PosCartTicket
              showBarcode={showBarcode}
              handleBarcodeScan={handleBarcodeScan}
              token={token}
              orgId={orgId}
              barcodeScanError={barcodeScanError}
              cartLines={cartLines}
              itemMap={itemMap}
              stockMap={stockMap}
              total={total}
              showOrderType={showOrderType}
              orderType={orderType}
              showTableSelect={showTableSelect}
              operatorTableSelectOptions={operatorTableSelectOptions}
              tableId={tableId}
              createSaleAndLinesMutation={createSaleAndLinesMutation}
              currentShift={currentShift}
              tenderTypes={tenderTypes}
              hasInsufficientStock={hasInsufficientStock}
              insufficientStockMessage={insufficientStockMessage}
              onProceedExtra={() => setMobileCartOpen(false)}
              onClose={() => setMobileCartOpen(false)}
            />
          </div>
        )}

        {/* CHECKOUT & PAYMENT MODAL */}
        {saleForPayment && orgId && branchId && terminalId && (
          <PosPaymentModal
            sale={saleForPayment}
            token={token}
            orgId={orgId}
            branchId={branchId}
            terminalId={terminalId}
            tenderTypes={tenderTypes}
            mpesaStkEnabled={mpesaStkEnabled}
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
            onRemoveTender={(tenderId) => removeTenderMutation.mutate(tenderId)}
            onComplete={handleCompletePayment}
            onCompleteWithDebt={handleCompleteWithDebt}
            onSaleUpdated={(sale) => {
              setSaleForPayment(sale);
              const tendered = (sale.tenders ?? []).reduce(
                (s, t) => s + (Number(t.amount) || 0),
                0
              );
              const total = Number(sale.total) || 0;
              const remainder = total - tendered;
              setAddTenderAmount(remainder > 0 ? String(remainder) : "");
            }}
            onStkAutoCompleted={handleStkAutoCompleted}
            onClose={() => setSaleForPayment(null)}
            isAddingTender={addTenderMutation.isPending}
            isRemovingTender={removeTenderMutation.isPending}
            isCompleting={completePaymentMutation.isPending}
            isCompletingWithDebt={completeWithDebtMutation.isPending}
            addTenderError={
              addTenderMutation.isError ? getApiErrorMessage(addTenderMutation.error) : null
            }
            removeTenderError={
              removeTenderMutation.isError ? getApiErrorMessage(removeTenderMutation.error) : null
            }
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

      {/* Item Modifiers Modal */}
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

      {/* Sale Receipt Modal */}
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
