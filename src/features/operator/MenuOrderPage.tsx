import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
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
import { fetchItems, fetchItemByBarcode, fetchItemModifierGroups } from "@/api/items";
import { fetchPriceListItems } from "@/api/priceLists";
import { fetchOperatorTables } from "@/api/tables";
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
import { fetchPriceLists } from "@/api/priceLists";
import { fetchStockLevels } from "@/api/stockLevels";
import { formatCurrency } from "@/utils/formatCurrency";
import { getItemImageUrl } from "@/utils/itemImage";
import { MenuItemCard } from "@/components/MenuItemCard";
import { PageHeader } from "@/components/PageHeader";
import { SearchableSelect } from "@/components/SearchableSelect";
import { BarcodeCaptureInput } from "@/components/BarcodeCaptureInput";
import { ModifierModal } from "@/components/ModifierModal";
import { ReceiptModal } from "@/components/ReceiptModal";
import { getApiErrorMessage } from "@/utils/apiError";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import {
  MENU_ORDER_SHOW_ORDER_TYPE,
  MENU_ORDER_SHOW_TABLE_SELECT,
  MENU_ORDER_SHOW_ITEM_LIST,
  isMenuOrderOptionVisible,
} from "@/config/menuOrderVisibility";
import { BARCODE_MENU_ORDER, isBarcodeVisible } from "@/config/barcodeVisibility";
import type { Item } from "@/types/catalog";
import type { CartLine, CartModifier } from "@/store/slices/cartSlice";
import type { ReceiptDetailResponse, Sale, Tender } from "@/types/sales";
import {
  Minus,
  Plus,
  Trash2,
  CreditCard,
  X,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  ShoppingCart,
} from "lucide-react";

const GRID_PAGE_SIZE = 20;

function isItemOutOfStock(item: Item, stockMap: Map<string, number>): boolean {
  if (!item.trackInventory) {
    return false;
  }
  const onHand = stockMap.get(item.id) ?? 0;
  return Math.max(0, Math.floor(onHand)) <= 0;
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

function usePriceMap(orgId: string | null, priceListId: string | null, token: string | null) {
  const enabled = Boolean(orgId && priceListId && token);
  const { data: priceItemsPage, isSuccess } = useQuery({
    queryKey: ["priceListItems", orgId, priceListId],
    queryFn: () =>
      fetchPriceListItems(token!, orgId!, priceListId!, { page: 0, size: 2000 }),
    enabled,
  });
  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    const items = priceItemsPage?.content ?? [];
    for (const p of items) {
      const num = typeof p.price === "number" ? p.price : Number(p.price);
      if (!Number.isNaN(num)) map.set(p.itemId, num);
    }
    return map;
  }, [priceItemsPage]);
  const priceListLoaded = !enabled || isSuccess;
  return { priceMap, priceListLoaded };
}

export function MenuOrderPage() {
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
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [gridPage, setGridPage] = useState(0);
  const [posExpanded, setPosExpanded] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const itemSearchRef = useRef<HTMLDivElement>(null);
  const searchListScrollRef = useRef<HTMLDivElement>(null);
  const [searchListScrollTop, setSearchListScrollTop] = useState(0);
  const [searchListHeight, setSearchListHeight] = useState(320);

  const SEARCH_ROW_HEIGHT = 36;
  const SEARCH_ROW_OVERSCAN = 8;
  const SEARCH_ROW_BG_PALETTE = [
    "bg-slate-50 dark:bg-slate-800/90",
    "bg-blue-50/80 dark:bg-slate-700/85",
    "bg-primary-50/60 dark:bg-primary-900/25",
    "bg-slate-100/80 dark:bg-slate-800/80",
    "bg-blue-50/60 dark:bg-slate-700/80",
    "bg-primary-50/40 dark:bg-primary-900/20",
  ];
  const navContext = useNavVisibilityContextOrNull();
  const operatorVisibility = navContext?.operatorVisibility ?? {};
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
  const showBarcode = isBarcodeVisible(operatorVisibility, BARCODE_MENU_ORDER);

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
  const priceListQueryEnabled = Boolean(orgId && effectivePriceListId && token);
  const { priceMap, priceListLoaded } = usePriceMap(orgId, effectivePriceListId, token);

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

  const orderTypeSelectOptions = useMemo(
    () => [
      { value: "DINE_IN", label: "Dine-in" },
      { value: "TAKEAWAY", label: "Takeaway" },
      { value: "DELIVERY", label: "Delivery" },
    ],
    []
  );

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
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
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
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: ["operator-debts-pending-total"] });
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

  const catalogItemsForPos = useMemo(() => {
    const raw = itemsData?.content ?? [];
    if (!priceListQueryEnabled || !priceListLoaded) {
      return raw;
    }
    return raw.filter((i) => priceMap.has(i.id));
  }, [itemsData?.content, priceListQueryEnabled, priceListLoaded, priceMap]);

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
    const byCategory =
      selectedCategoryId === null
        ? catalogItemsForPos
        : catalogItemsForPos.filter((i: Item) => i.categoryId === selectedCategoryId);
    return filterOutOfStockItems(byCategory, stockMap, hideOutOfStock);
  }, [catalogItemsForPos, selectedCategoryId, stockMap, hideOutOfStock]);

  // Reset grid page when filters change
  useEffect(() => {
    setGridPage(0);
  }, [selectedCategoryId, hideOutOfStock]);

  const gridTotalPages = Math.max(1, Math.ceil(items.length / GRID_PAGE_SIZE));
  const pagedItems = useMemo(
    () => items.slice(gridPage * GRID_PAGE_SIZE, (gridPage + 1) * GRID_PAGE_SIZE),
    [items, gridPage],
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
    (item: Item) => {
      if (!priceListQueryEnabled || !priceListLoaded) {
        return true;
      }
      return priceMap.has(item.id);
    },
    [priceListQueryEnabled, priceListLoaded, priceMap]
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

  const handleAddToCart = async (item: Item): Promise<boolean> => {
    if (!canSellOnPos(item)) {
      return false;
    }
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
      return false;
    }
    setModifierModalItem({ item, price });
    return true;
  };

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
    [token, orgId, canSellOnPos]
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

  const allItemsForSearch = catalogItemsForPos;
  const searchFilteredItems = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    const byQuery =
      !q
        ? allItemsForSearch
        : allItemsForSearch.filter((i: Item) => i.name.toLowerCase().includes(q));
    return filterOutOfStockItems(byQuery, stockMap, hideOutOfStock);
  }, [allItemsForSearch, itemSearchQuery, stockMap, hideOutOfStock]);

  const searchVirtualSlice = useMemo(() => {
    const n = searchFilteredItems.length;
    if (n === 0) return { start: 0, end: 0, totalHeight: 0 };
    const totalHeight = n * SEARCH_ROW_HEIGHT;
    const start = Math.max(
      0,
      Math.floor(searchListScrollTop / SEARCH_ROW_HEIGHT) - SEARCH_ROW_OVERSCAN
    );
    const visibleCount = Math.ceil(searchListHeight / SEARCH_ROW_HEIGHT);
    const end = Math.min(
      n,
      start + visibleCount + SEARCH_ROW_OVERSCAN * 2
    );
    return { start, end: Math.max(start, end), totalHeight };
  }, [
    searchFilteredItems.length,
    searchListScrollTop,
    searchListHeight,
  ]);

  useLayoutEffect(() => {
    if (!itemSearchOpen || searchFilteredItems.length === 0) return;
    const el = searchListScrollRef.current;
    if (el) setSearchListHeight(el.clientHeight);
  }, [itemSearchOpen, searchFilteredItems.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        itemSearchRef.current &&
        !itemSearchRef.current.contains(e.target as Node)
      ) {
        setItemSearchOpen(false);
      }
    };
    if (itemSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [itemSearchOpen]);

  const handleSearchItemCheck = async (item: Item, checked: boolean) => {
    if (checked) {
      const price = priceMap.get(item.id) ?? 0;
      const onHand = item.trackInventory
        ? (stockMap.get(item.id) ?? 0)
        : Infinity;
      const available =
        item.active && (item.trackInventory ? onHand > 0 : true);
      const priceSet = price > 0;
      if (!available || !priceSet) return;
      const openedModifierModal = await handleAddToCart(item);
      if (openedModifierModal) setItemSearchOpen(false);
    } else {
      handleReduceFromCart(item.id);
    }
  };

  return (
    <>
    <div className={`flex touch-manipulation flex-col lg:flex-row ${posExpanded ? "fixed inset-0 z-40 bg-white dark:bg-slate-900" : "h-full min-h-0"}`}>
      {/* Main content: categories + item grid */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-20 lg:pb-4">
        {!posExpanded && (
          <PageHeader
            title="POS"
            subtitle="Select items and proceed to payment"
            fallbackTo="/operator"
            noMargin
            className="mb-2 shrink-0"
          />
        )}
        {showItemList ? (
        <>
        {/* Category tabs row — swipe/scroll horizontally when many */}
        <div className="mb-4 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scroll-smooth pb-1 snap-x snap-mandatory scrollbar-blend">
          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className={`min-h-[44px] snap-start shrink-0 whitespace-nowrap touch-manipulation rounded-lg px-4 py-2.5 text-base font-semibold transition ${
              selectedCategoryId === null
                ? "bg-primary-600 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            All ({visibleCountForCategory(null)})
          </button>
          {categoriesLoading
            ? null
            : categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`min-h-[44px] snap-start shrink-0 whitespace-nowrap touch-manipulation rounded-lg px-4 py-2.5 text-base font-semibold transition ${
                    selectedCategoryId === cat.id
                      ? "bg-primary-600 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                >
                  {cat.name} ({visibleCountForCategory(cat.id)})
                </button>
              ))}
          <button
            type="button"
            role="switch"
            aria-checked={hideOutOfStock}
            aria-label={
              hideOutOfStock
                ? "Out-of-stock items are hidden. Show them in the menu."
                : "Hide out-of-stock items from the menu."
            }
            onClick={() => setHideOutOfStock((v) => !v)}
            className={`ml-1 flex min-h-[44px] snap-start touch-manipulation items-center gap-1.5 rounded-lg border px-4 py-2.5 text-base font-semibold transition active:scale-[0.98] ${
              hideOutOfStock
                ? "border-primary-500 bg-primary-600/15 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-200"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            }`}
            title={
              hideOutOfStock
                ? "Out-of-stock items are hidden. Click to show them."
                : "All items shown. Click to hide out-of-stock."
            }
          >
            {hideOutOfStock ? (
              <Eye className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="max-w-[9rem] truncate sm:max-w-none">
              {hideOutOfStock ? "Show OOS" : "Hide OOS"}
            </span>
          </button>
          </div>
          <div ref={itemSearchRef} className="relative z-30 shrink-0">
            <button
              type="button"
              onClick={() => setItemSearchOpen((o) => !o)}
              className="flex min-h-[36px] min-w-0 touch-manipulation items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              aria-expanded={itemSearchOpen}
              aria-haspopup="listbox"
              aria-label="Search and select items"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate sm:max-w-[180px]">
                {itemSearchOpen ? "Search items…" : "Search & add items…"}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition dark:text-slate-400 ${
                  itemSearchOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {itemSearchOpen && (
              <div
                className="fixed inset-x-4 top-auto z-50 mt-1 max-h-[min(60vh,400px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:w-[380px] dark:border-slate-600 dark:bg-slate-800"
              role="listbox"
              aria-multiselectable
              aria-label="Sellable items"
            >
              <div className="border-b border-slate-200 p-2 pl-2 pr-4 dark:border-slate-600">
                <input
                  type="search"
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="Type to search…"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400"
                  aria-label="Filter items"
                  autoFocus
                />
              </div>
              <div
                ref={searchListScrollRef}
                onScroll={() =>
                  setSearchListScrollTop(searchListScrollRef.current?.scrollTop ?? 0)
                }
                className="max-h-[min(45vh,320px)] overflow-y-auto p-1.5"
              >
                {searchFilteredItems.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    No items match
                  </p>
                ) : (
                  <div
                    style={{ minHeight: searchVirtualSlice.totalHeight }}
                    className="relative"
                  >
                    <div
                      style={{
                        height: searchVirtualSlice.start * SEARCH_ROW_HEIGHT,
                      }}
                      aria-hidden
                    />
                    {searchFilteredItems
                      .slice(searchVirtualSlice.start, searchVirtualSlice.end)
                      .map((item: Item, i: number) => {
                        const index = searchVirtualSlice.start + i;
                        const onHand = item.trackInventory
                          ? (stockMap.get(item.id) ?? 0)
                          : Infinity;
                        const price = priceMap.get(item.id) ?? 0;
                        const available =
                          item.active &&
                          (item.trackInventory ? onHand > 0 : true);
                        const priceSet = price > 0;
                        const canSelect = available && priceSet;
                        const qtyInCart = getQtyInCart(item.id);
                        const isChecked = qtyInCart > 0;
                        const rowBg =
                          SEARCH_ROW_BG_PALETTE[
                            index % SEARCH_ROW_BG_PALETTE.length
                          ];
                        return (
                          <label
                            key={item.id}
                            className={`flex touch-manipulation cursor-pointer items-center gap-2 rounded-lg px-2 text-sm transition ${rowBg} ${
                              canSelect
                                ? "hover:bg-primary-100 dark:hover:bg-primary-700/50"
                                : "cursor-not-allowed opacity-60"
                            }`}
                            style={{
                              minHeight: SEARCH_ROW_HEIGHT,
                              height: SEARCH_ROW_HEIGHT,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                handleSearchItemCheck(item, e.target.checked)
                              }
                              disabled={!canSelect}
                              className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                              aria-label={`${item.name}, ${formatCurrency(price)}`}
                            />
                            <span className="min-w-0 flex-1 truncate font-semibold text-white">
                              {item.name}
                            </span>
                            <span className="shrink-0 tabular-nums font-medium text-primary-400">
                              {formatCurrency(price)}
                            </span>
                            {item.trackInventory && (
                              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                                {onHand > 0
                                  ? `${Math.floor(onHand)} in stock`
                                  : "Out"}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    <div
                      style={{
                        height:
                          (searchFilteredItems.length - searchVirtualSlice.end) *
                          SEARCH_ROW_HEIGHT,
                      }}
                      aria-hidden
                    />
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPosExpanded((v) => !v)}
            className="flex min-h-[36px] shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 active:scale-[0.97] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            title={posExpanded ? "Exit full screen" : "Expand"}
            aria-label={posExpanded ? "Exit full screen" : "Expand"}
          >
            {posExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {!itemsLoading && items.length > GRID_PAGE_SIZE && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {gridPage * GRID_PAGE_SIZE + 1}–{Math.min((gridPage + 1) * GRID_PAGE_SIZE, items.length)} of {items.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={gridPage === 0}
                  onClick={() => setGridPage((p) => p - 1)}
                  className="flex min-h-[36px] touch-manipulation items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <span className="min-w-[3.5rem] text-center text-sm text-slate-500 dark:text-slate-400">
                  {gridPage + 1} / {gridTotalPages}
                </span>
                <button
                  type="button"
                  disabled={gridPage >= gridTotalPages - 1}
                  onClick={() => setGridPage((p) => p + 1)}
                  className="flex min-h-[36px] touch-manipulation items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-4">
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
            : pagedItems.map((item: Item) => {
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
          {!itemsLoading && items.length > GRID_PAGE_SIZE && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {gridPage * GRID_PAGE_SIZE + 1}–{Math.min((gridPage + 1) * GRID_PAGE_SIZE, items.length)} of {items.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={gridPage === 0}
                  onClick={() => setGridPage((p) => p - 1)}
                  className="flex min-h-[36px] touch-manipulation items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <span className="min-w-[3.5rem] text-center text-sm text-slate-500 dark:text-slate-400">
                  {gridPage + 1} / {gridTotalPages}
                </span>
                <button
                  type="button"
                  disabled={gridPage >= gridTotalPages - 1}
                  onClick={() => setGridPage((p) => p + 1)}
                  className="flex min-h-[36px] touch-manipulation items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Item list is hidden. Change in Admin → Settings → POS.
          </p>
        )}
      </div>

      {/* Order summary sidebar — desktop only */}
      <aside className="hidden min-h-0 max-h-full w-[32rem] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white lg:flex dark:border-slate-700 dark:bg-slate-800/80">
        <CartSidebarContent
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
          orderTypeSelectOptions={orderTypeSelectOptions}
          orderType={orderType}
          dispatch={dispatch}
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

      {/* Mobile floating cart bar — shown only when cart has items and mobile overlay is closed */}
      {cartLines.length > 0 && !mobileCartOpen && (
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-primary-600 px-5 py-3.5 shadow-xl transition active:scale-[0.98] lg:hidden dark:bg-primary-700"
        >
          <span className="flex items-center gap-2 text-white">
            <ShoppingCart className="h-5 w-5" />
            <span className="text-base font-semibold">
              Cart ({cartLines.reduce((s, l) => s + l.qty, 0)})
            </span>
          </span>
          <span className="text-base font-bold text-white">
            {formatCurrency(total)}
          </span>
        </button>
      )}

      {/* Mobile cart overlay — full-screen on < lg */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden dark:bg-slate-900">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <ShoppingCart className="h-5 w-5" />
              Order Summary
            </h2>
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <CartSidebarContent
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
            orderTypeSelectOptions={orderTypeSelectOptions}
            orderType={orderType}
            dispatch={dispatch}
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
          onRemoveTender={(tenderId) => removeTenderMutation.mutate(tenderId)}
          onComplete={handleCompletePayment}
          onCompleteWithDebt={handleCompleteWithDebt}
          onClose={() => setSaleForPayment(null)}
          isAddingTender={addTenderMutation.isPending}
          isRemovingTender={removeTenderMutation.isPending}
          isCompleting={completePaymentMutation.isPending}
          isCompletingWithDebt={completeWithDebtMutation.isPending}
          addTenderError={addTenderMutation.isError ? getApiErrorMessage(addTenderMutation.error) : null}
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

/* eslint-disable @typescript-eslint/no-explicit-any */
function CartSidebarContent({
  showBarcode,
  handleBarcodeScan,
  token,
  orgId,
  barcodeScanError,
  cartLines,
  itemMap,
  stockMap,
  total,
  showOrderType,
  orderTypeSelectOptions,
  orderType,
  dispatch,
  showTableSelect,
  operatorTableSelectOptions,
  tableId,
  createSaleAndLinesMutation,
  currentShift,
  tenderTypes,
  hasInsufficientStock,
  insufficientStockMessage,
  onProceedExtra,
  onClose,
}: {
  showBarcode: boolean;
  handleBarcodeScan: (barcode: string) => void;
  token: string | null;
  orgId: string | null;
  barcodeScanError: string | null;
  cartLines: CartLine[];
  itemMap: Map<string, Item>;
  stockMap: Map<string, number>;
  total: number;
  showOrderType: boolean;
  orderTypeSelectOptions: { value: string; label: string }[];
  orderType: string;
  dispatch: any;
  showTableSelect: boolean;
  operatorTableSelectOptions: { value: string; label: string }[];
  tableId: string | null;
  createSaleAndLinesMutation: any;
  currentShift: any;
  tenderTypes: any[];
  hasInsufficientStock: boolean;
  insufficientStockMessage: string;
  onProceedExtra?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex min-h-0 max-h-full flex-1 flex-col overflow-hidden px-4 pb-2 pt-3">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          Order Summary
          {cartLines.length > 0 && (
            <span className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full bg-primary-600 px-3 text-base font-bold tabular-nums text-white" style={{ lineHeight: '36px' }}>
              {cartLines.reduce((sum, l) => sum + l.qty, 0)}
            </span>
          )}
        </h2>
        {cartLines.length > 0 && (
          <button
            type="button"
            onClick={() => dispatch(clearCart())}
            className="flex min-h-[32px] touch-manipulation items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.97] dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>
      {showBarcode && (
        <div className="mb-2 shrink-0">
          <BarcodeCaptureInput
            onScan={handleBarcodeScan}
            placeholder="Scan barcode to add…"
            compact
            disabled={!token || !orgId}
          />
          {barcodeScanError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
              {barcodeScanError}
            </p>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden">
        {cartLines.length === 0 ? (
          <p className="py-4 text-center text-slate-500">No items yet</p>
        ) : (
          cartLines.map((line: CartLine) => (
            <OrderLineRow
              key={line.tempId}
              line={line}
              stockOnHand={
                (() => {
                  const item = itemMap.get(line.itemId);
                  if (!item?.trackInventory) return undefined;
                  return stockMap.get(line.itemId) ?? 0;
                })()
              }
              trackInventory={itemMap.get(line.itemId)?.trackInventory ?? false}
            />
          ))
        )}
      </div>
      <div className="mt-1 shrink-0 border-t border-slate-200 pt-2 dark:border-slate-600">
        <div className="flex items-center justify-between text-3xl font-bold text-slate-900 dark:text-white">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
      <div className="mt-1.5 shrink-0 flex flex-col gap-2">
        {showOrderType && (
          <SearchableSelect
            options={orderTypeSelectOptions}
            value={orderType}
            onChange={(v: string) =>
              dispatch(setOrderType(v as "DINE_IN" | "TAKEAWAY" | "DELIVERY"))
            }
            placeholder="Search order type…"
            className="min-h-[48px] touch-manipulation"
            controlClassName="min-h-[48px] rounded-xl border-slate-300 bg-slate-50 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
            aria-label="Order type"
          />
        )}
        {showTableSelect && (
          <SearchableSelect
            options={operatorTableSelectOptions}
            value={tableId ?? ""}
            onChange={(v: string) => dispatch(setTableId(v || null))}
            placeholder="Search table…"
            className="min-h-[48px] touch-manipulation"
            controlClassName="min-h-[48px] rounded-xl border-slate-300 bg-slate-50 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
            aria-label="Select table"
          />
        )}
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
        onClick={() => {
          createSaleAndLinesMutation.mutate();
          onProceedExtra?.();
        }}
        className="mt-1.5 shrink-0 min-h-[48px] w-full touch-manipulation rounded-xl bg-primary-600 py-3 text-lg font-bold text-white transition hover:bg-primary-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-primary-500"
      >
        {createSaleAndLinesMutation.isPending ? "Processing…" : "Proceed to payment"}
      </button>
      {!currentShift && (
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
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-2 shrink-0 min-h-[44px] w-full touch-manipulation rounded-xl border border-slate-300 py-2.5 text-base font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-[0.99] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Back to menu
        </button>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  onRemoveTender,
  onComplete,
  onCompleteWithDebt,
  onClose,
  isAddingTender,
  isRemovingTender,
  isCompleting,
  isCompletingWithDebt,
  addTenderError,
  removeTenderError,
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
  onRemoveTender: (tenderId: string) => void;
  onComplete: () => void;
  onCompleteWithDebt?: (body: {
    customerName: string;
    customerPhone?: string;
    dueDate?: string;
  }) => void;
  onClose: () => void;
  isAddingTender: boolean;
  isRemovingTender: boolean;
  isCompleting: boolean;
  isCompletingWithDebt?: boolean;
  addTenderError: string | null;
  removeTenderError: string | null;
  completeError: string | null;
  completeWithDebtError?: string | null;
}) {
  const total = Number(sale.total) || 0;
  const remainder = total - totalTendered;
  const [debtCustomerName, setDebtCustomerName] = useState("");
  const [debtCustomerPhone, setDebtCustomerPhone] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  const paymentTenderTypeOptions = useMemo(
    () =>
      tenderTypes.map((t) => ({
        value: t.id,
        label: `${t.name} (${t.code})`,
      })),
    [tenderTypes]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[90vh] dark:border-slate-600 dark:bg-slate-800">
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
          {(sale.lines?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Items to pay
              </h3>
              <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">&larr; swipe table to see all columns &rarr;</p>
              <div
                className="relative overflow-auto rounded-xl border border-slate-200 dark:border-slate-600"
                role="region"
                aria-label="Sale line items and subtotals"
              >
                <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                <table className="w-full text-left text-xs sm:text-sm" style={{ minWidth: "420px" }}>
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400">
                    <tr>
                      <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 sm:px-3 dark:bg-slate-700/80">Item</th>
                      <th className="px-2 py-2 text-right sm:px-3">Qty</th>
                      <th className="px-2 py-2 text-right sm:px-3">Unit</th>
                      <th className="px-2 py-2 text-right sm:px-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {(sale.lines ?? []).map((line) => (
                      <Fragment key={line.id}>
                        <tr className="text-slate-800 dark:text-white">
                          <td className="sticky left-0 z-10 max-w-[7rem] bg-white px-2 py-1.5 align-top sm:max-w-[10rem] sm:px-3 sm:py-2 dark:bg-slate-800">
                            <span className="font-medium leading-snug">{line.itemName}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums align-top sm:px-3 sm:py-2">{line.qty}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 align-top sm:px-3 sm:py-2 dark:text-slate-300">
                            {formatCurrency(line.unitPrice)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold align-top sm:px-3 sm:py-2">
                            {formatCurrency(line.lineTotal)}
                          </td>
                        </tr>
                        {(line.modifiers ?? []).map((m) => {
                          const modAmt = m.unitPriceDelta * m.qty;
                          return (
                            <tr
                              key={`${line.id}-mod-${m.id}`}
                              className="bg-slate-50/80 text-xs text-slate-600 dark:bg-slate-800/40 dark:text-slate-400"
                            >
                              <td className="px-2 py-1.5 pl-6 sm:px-3" colSpan={2}>
                                + {m.modifierOptionName}
                                {m.qty > 1 ? ` × ${m.qty}` : ""}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums sm:px-3">
                                {modAmt !== 0 ? formatCurrency(m.unitPriceDelta) : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums sm:px-3">
                                {modAmt !== 0 ? formatCurrency(modAmt) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                Payment added
              </h3>
              <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/30">
                {sale.tenders.map((t: Tender) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 text-sm text-slate-800 dark:text-white"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{t.tenderTypeCode ?? "—"}</span>
                      <span className="ml-2 tabular-nums">{formatCurrency(t.amount)}</span>
                    </span>
                    <button
                      type="button"
                      disabled={isRemovingTender}
                      onClick={() => onRemoveTender(t.id)}
                      className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-600/30 dark:hover:text-red-300"
                      aria-label={`Remove ${t.tenderTypeCode ?? "payment"} ${formatCurrency(t.amount)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {removeTenderError && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {removeTenderError}
                </p>
              )}
            </div>
          )}

          {(!sale.tenders || sale.tenders.length === 0) ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Add payment
              </h3>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <SearchableSelect
                  options={paymentTenderTypeOptions}
                  value={addTenderTypeId}
                  onChange={setAddTenderTypeId}
                  placeholder="Search payment type…"
                  matchOptionValue
                  className="min-h-[48px] min-w-0 flex-1 basis-full sm:basis-auto"
                  controlClassName="min-h-[48px] rounded-xl border-slate-300 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500 dark:border-slate-600"
                  aria-label="Payment type"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addTenderAmount}
                  onChange={(e) => setAddTenderAmount(e.target.value)}
                  placeholder="Amount"
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-right tabular-nums text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-28 sm:flex-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Only one payment at a time. Remove the payment above to add a different one.
            </p>
          )}
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

function OrderLineRow({
  line,
  stockOnHand,
  trackInventory,
}: {
  line: CartLine;
  stockOnHand?: number;
  trackInventory?: boolean;
}) {
  const dispatch = useAppDispatch();
  const lineTotal =
    line.unitPrice * line.qty +
    line.modifiers.reduce((s, m) => s + m.unitPriceDelta * m.qty, 0);

  const maxQty =
    trackInventory && typeof stockOnHand === "number"
      ? Math.max(0, Math.floor(stockOnHand))
      : undefined;
  const canAddMore = maxQty === undefined || line.qty < maxQty;

  const handleReduce = () => {
    if (line.qty <= 1) {
      dispatch(removeLine(line.tempId));
    } else {
      dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty - 1 }));
    }
  };

  const handleAdd = () => {
    if (!canAddMore) return;
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
            disabled={!canAddMore}
            title={
              !canAddMore && maxQty !== undefined
                ? `Only ${maxQty} in stock`
                : undefined
            }
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-r-xl text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-600"
            aria-label={
              canAddMore
                ? `Increase quantity of ${line.itemName}`
                : `Cannot add more; ${maxQty ?? 0} in stock`
            }
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
