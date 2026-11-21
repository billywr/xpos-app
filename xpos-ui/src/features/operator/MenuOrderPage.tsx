import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";
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
import { fetchOperatorTables } from "@/api/tables";
import {
  fetchMpesaStkStatus,
  fetchMpesaOperatorSettings,
  initiateMpesaStk,
  type MpesaStkStatus,
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
import { formatCurrency, formatAmount } from "@/utils/formatCurrency";
import {
  getLastMpesaStkPhone,
  rememberMpesaStkPhone,
} from "@/utils/mpesaPhoneHistory";
import { MpesaStkPhoneInput } from "@/components/MpesaStkPhoneInput";
import { formatQty } from "@/utils/formatQuantity";
import { getItemImageUrl } from "@/utils/itemImage";
import { MenuItemCard } from "@/components/MenuItemCard";
import { PageHeader } from "@/components/PageHeader";
import {
  tableBodyRow,
  tableHeadRow,
  DateInput,
} from "@/components/ui";
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
  MENU_ORDER_SHOW_HIDE_OOS,
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
  Smartphone,
  Loader2,
} from "lucide-react";

const TERMINAL_STK_STATUSES: MpesaStkStatus[] = [
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "TIMEOUT",
];

const GRID_PAGE_SIZE = 20;

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
  const [posExpanded, setPosExpanded] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const itemSearchRef = useRef<HTMLDivElement>(null);
  const itemSearchDropdownRef = useRef<HTMLDivElement>(null);
  const searchListScrollRef = useRef<HTMLDivElement>(null);

  /** ~3× original 14px item text; row height kept tight (not 3× row padding). */
  const SEARCH_ROW_HEIGHT = 44;
  const SEARCH_ITEM_TEXT = "text-[1.75rem] leading-none tracking-tight";
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
      queryClient.invalidateQueries({ queryKey: ["openOrHeldSales"] });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
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
    return filterOutOfStockItems(byQuery, stockMap, true);
  }, [allItemsForSearch, itemSearchQuery, stockMap]);

  useLayoutEffect(() => {
    if (!itemSearchOpen) return;

    const list = searchListScrollRef.current;
    if (list) {
      list.scrollTop = 0;
    }

    const updateHeights = () => {
      const dropdown = itemSearchDropdownRef.current;
      if (!dropdown) return;

      const top = dropdown.getBoundingClientRect().top;
      const available = Math.max(280, window.innerHeight - top - 16);
      dropdown.style.maxHeight = `${available}px`;
      dropdown.style.height = `${available}px`;
    };

    updateHeights();
    const ro = new ResizeObserver(updateHeights);
    if (itemSearchDropdownRef.current) {
      ro.observe(itemSearchDropdownRef.current);
    }
    window.addEventListener("resize", updateHeights);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeights);
    };
  }, [itemSearchOpen, posExpanded]);

  useLayoutEffect(() => {
    if (!itemSearchOpen) return;
    const list = searchListScrollRef.current;
    if (list) {
      list.scrollTop = 0;
    }
  }, [itemSearchQuery, itemSearchOpen]);

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
      const price = item.defaultSellingPrice ?? 0;
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
            fallbackTo={fallbackTo}
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
          {showHideOosToggle && (
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
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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
          )}
          </div>
          <div ref={itemSearchRef} className="relative z-30 shrink-0">
            <button
              type="button"
              onClick={() => setItemSearchOpen((o) => !o)}
              className="flex min-h-[36px] min-w-0 touch-manipulation items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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
                ref={itemSearchDropdownRef}
                className="fixed inset-x-2 top-auto z-50 mt-1 flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:w-[720px] sm:max-w-[min(96vw,840px)] dark:border-slate-600 dark:bg-slate-800"
              role="listbox"
              aria-multiselectable
              aria-label="Sellable items"
            >
              <div className="shrink-0 border-b border-slate-200 p-2 dark:border-slate-600">
                <input
                  type="search"
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="Type to search…"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-2xl leading-tight text-slate-900 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400"
                  aria-label="Filter items"
                  autoFocus
                />
              </div>
              <div
                ref={searchListScrollRef}
                className="min-h-0 flex-1 overflow-y-auto p-1"
              >
                {searchFilteredItems.length === 0 ? (
                  <p className="py-3 text-center text-xl text-slate-500 dark:text-slate-400">
                    No items match
                  </p>
                ) : (
                  searchFilteredItems.map((item: Item, index: number) => {
                        const onHand = item.trackInventory
                          ? (stockMap.get(item.id) ?? 0)
                          : Infinity;
                        const price = item.defaultSellingPrice ?? 0;
                        const available =
                          item.active &&
                          (item.trackInventory ? onHand > 0 : true);
                        const priceSet = price > 0;
                        const canSelect = available && priceSet;
                        const qtyInCart = getQtyInCart(item.id);
                        const isChecked = qtyInCart > 0;
                        const rowBase = isChecked
                          ? "bg-primary-50 dark:bg-slate-800 dark:ring-1 dark:ring-inset dark:ring-primary-500/50"
                          : index % 2 === 1
                            ? "bg-slate-50 dark:bg-slate-800"
                            : "bg-white dark:bg-slate-800";
                        return (
                          <label
                            key={item.id}
                            className={`menu-order-search-row flex touch-manipulation items-center gap-2 rounded-md px-2 py-0 ${SEARCH_ITEM_TEXT} transition-colors ${rowBase} ${
                              canSelect
                                ? "can-select cursor-pointer"
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
                              className="h-6 w-6 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-500 dark:bg-slate-700"
                              aria-label={`${item.name}, ${formatCurrency(price)}`}
                            />
                            <span className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-white">
                              {item.name}
                            </span>
                            <span className="shrink-0 tabular-nums font-medium text-primary-600 dark:text-primary-400">
                              {formatCurrency(price)}
                            </span>
                            {item.trackInventory && (
                              <span className="shrink-0 text-lg leading-none text-slate-500 dark:text-slate-300">
                                {onHand > 0
                                  ? `${formatQty(onHand)} in stock`
                                  : "Out"}
                              </span>
                            )}
                          </label>
                        );
                      })
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
      <aside className="hidden min-h-0 max-h-full w-[32rem] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white lg:flex dark:border-slate-700 dark:bg-slate-800">
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

      {saleForPayment && orgId && branchId && terminalId && (
        <PaymentModal
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
  token,
  orgId,
  branchId,
  terminalId,
  tenderTypes,
  mpesaStkEnabled,
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
  onSaleUpdated,
  onStkAutoCompleted,
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
  token: string | null;
  orgId: string;
  branchId: string;
  terminalId: string;
  tenderTypes: { id: string; code: string; name: string }[];
  mpesaStkEnabled: boolean;
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
  onSaleUpdated: (sale: Sale) => void;
  onStkAutoCompleted: () => void;
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
  const [paymentMode, setPaymentMode] = useState<"manual" | "stk">("manual");
  const [stkPhone, setStkPhone] = useState("");
  const [stkRequestId, setStkRequestId] = useState<string | null>(null);
  const [stkStatus, setStkStatus] = useState<MpesaStkStatus | null>(null);
  const [stkMessage, setStkMessage] = useState<string | null>(null);
  const [stkError, setStkError] = useState<string | null>(null);
  const [isSendingStk, setIsSendingStk] = useState(false);
  const stkPolling = stkRequestId != null && stkStatus === "PENDING";

  useEffect(() => {
    const last = getLastMpesaStkPhone(orgId, branchId);
    if (last) {
      setStkPhone(last);
    }
  }, [orgId, branchId]);

  useEffect(() => {
    if (!mpesaStkEnabled && paymentMode === "stk") {
      setPaymentMode("manual");
    }
  }, [mpesaStkEnabled, paymentMode]);

  const cashTenderTypeId =
    tenderTypes.find((t) => t.code === "CASH")?.id ?? tenderTypes[0]?.id ?? "";
  const cashPaymentMode = mpesaStkEnabled && paymentMode === "manual";

  useEffect(() => {
    if (cashPaymentMode && cashTenderTypeId) {
      setAddTenderTypeId(cashTenderTypeId);
    }
  }, [cashPaymentMode, cashTenderTypeId, setAddTenderTypeId]);

  useEffect(() => {
    if (!stkPolling || !token) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await fetchMpesaStkStatus(
          token,
          orgId,
          branchId,
          terminalId,
          sale.id,
          stkRequestId
        );
        if (cancelled) {
          return;
        }
        setStkStatus(status.status);
        setStkMessage(status.resultDesc);
        if (status.status === "SUCCESS") {
          const refreshed = await fetchSale(
            token,
            orgId,
            branchId,
            terminalId,
            sale.id
          );
          if (!cancelled) {
            onSaleUpdated(refreshed);
            const tendered = (refreshed.tenders ?? []).reduce(
              (sum, t) => sum + (Number(t.amount) || 0),
              0
            );
            const saleTotal = Number(refreshed.total) || 0;
            if (tendered >= saleTotal) {
              setStkMessage("M-PESA payment received. Tap Complete sale below.");
              setPaymentMode("manual");
            }
            if (status.saleCompleted) {
              onStkAutoCompleted();
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStkError(getApiErrorMessage(err));
        }
      }
    };
    poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    stkPolling,
    token,
    orgId,
    branchId,
    terminalId,
    sale.id,
    stkRequestId,
    onSaleUpdated,
    onStkAutoCompleted,
  ]);

  const handleSendStk = async () => {
    if (!token || remainder <= 0) {
      return;
    }
    setIsSendingStk(true);
    setStkError(null);
    setStkMessage(null);
    try {
      const res = await initiateMpesaStk(
        token,
        orgId,
        branchId,
        terminalId,
        sale.id,
        { phoneNumber: stkPhone.trim(), amount: remainder }
      );
      setStkRequestId(res.id);
      setStkStatus(res.status);
      setStkMessage("M-PESA request sent. Customer should enter PIN on phone…");
      rememberMpesaStkPhone(orgId, branchId, stkPhone.trim());
    } catch (err) {
      setStkError(getApiErrorMessage(err));
    } finally {
      setIsSendingStk(false);
    }
  };

  const paymentTenderTypeOptions = useMemo(
    () =>
      tenderTypes.map((t) => ({
        value: t.id,
        label: `${t.name} (${t.code})`,
      })),
    [tenderTypes]
  );

  const showDebtSection =
    remainder > 0 && totalTendered > 0 && onCompleteWithDebt != null;
  const showCompleteSale = canComplete || isCompleting;
  const showPaymentFooter =
    showDebtSection ||
    showCompleteSale ||
    Boolean(completeError) ||
    Boolean(completeWithDebtError);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="flex min-h-[78vh] max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl sm:max-h-[94vh] dark:border-slate-600 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5 dark:border-slate-600">
          <h2
            id="payment-modal-title"
            className="flex items-center gap-3 text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white"
          >
            <CreditCard className="h-8 w-8 sm:h-10 sm:w-10" />
            Manage payments
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-3 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-7 w-7 sm:h-8 sm:w-8" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col space-y-8 overflow-y-auto p-8 sm:p-10">
          {(sale.lines?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-4 text-2xl font-bold text-slate-700 sm:text-3xl dark:text-slate-300">
                Items to pay
              </h3>
              <div
                className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600"
                role="region"
                aria-label="Sale line items and subtotals"
              >
                <table className="w-full table-fixed text-left text-xl sm:text-2xl">
                  <colgroup>
                    <col style={{ width: "3.5rem" }} />
                    <col />
                    <col style={{ width: "4.5rem" }} />
                    <col style={{ width: "9rem" }} />
                    <col style={{ width: "10rem" }} />
                  </colgroup>
                  <thead className={`border-b border-slate-200 bg-slate-50 dark:border-slate-600 ${tableHeadRow}`}>
                    <tr>
                      <th className="px-2 py-3 text-center text-lg font-bold text-slate-700 sm:text-xl dark:text-slate-300">
                        No.
                      </th>
                      <th className="px-3 py-3 text-left text-lg font-bold text-slate-700 sm:text-xl dark:text-slate-300">
                        Item
                      </th>
                      <th className="px-2 py-3 text-right text-lg font-bold text-slate-700 sm:text-xl dark:text-slate-300">
                        Qty
                      </th>
                      <th className="px-2 py-3 text-right text-lg font-bold text-slate-700 sm:text-xl dark:text-slate-300">
                        Unit
                      </th>
                      <th className="px-2 py-3 text-right text-lg font-bold text-slate-700 sm:px-4 sm:text-xl dark:text-slate-300">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {(sale.lines ?? []).map((line, index) => (
                      <Fragment key={line.id}>
                        <tr className={`${tableBodyRow} text-slate-800 dark:text-white`}>
                          <td className="px-2 py-3 text-center text-xl font-semibold tabular-nums text-slate-600 sm:text-2xl dark:text-slate-400">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className="block truncate font-bold text-slate-700 dark:text-slate-300">
                              {line.itemName}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right text-xl font-semibold tabular-nums text-slate-600 sm:text-2xl dark:text-slate-400">
                            {line.qty}
                          </td>
                          <td className="px-2 py-3 text-right text-xl font-semibold tabular-nums text-slate-600 sm:text-2xl dark:text-slate-400">
                            {formatAmount(line.unitPrice)}
                          </td>
                          <td className="px-2 py-3 text-right text-xl font-semibold tabular-nums text-slate-600 sm:px-4 sm:text-2xl dark:text-slate-400">
                            {formatAmount(line.lineTotal)}
                          </td>
                        </tr>
                        {(line.modifiers ?? []).map((m) => {
                          const modAmt = m.unitPriceDelta * m.qty;
                          return (
                            <tr
                              key={`${line.id}-mod-${m.id}`}
                              className="bg-slate-50/80 text-lg font-semibold text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 sm:text-xl"
                            >
                              <td className="px-3 py-2 pl-5" colSpan={3}>
                                + {m.modifierOptionName}
                                {m.qty > 1 ? ` × ${m.qty}` : ""}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums">
                                {modAmt !== 0 ? formatAmount(m.unitPriceDelta) : "—"}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums sm:px-4">
                                {modAmt !== 0 ? formatAmount(modAmt) : "—"}
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

          <div className="rounded-xl bg-slate-100 p-6 sm:p-8 dark:bg-slate-700/50">
            <div className="flex justify-between text-2xl font-bold text-slate-600 sm:text-3xl dark:text-slate-300">
              <span>Total due</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
            <div className="mt-3 flex justify-between text-2xl font-bold text-slate-600 sm:text-3xl dark:text-slate-300">
              <span>Tendered</span>
              <span className="tabular-nums">{formatCurrency(totalTendered)}</span>
            </div>
            {remainder > 0 && (
              <div className="mt-3 flex justify-between text-2xl font-bold text-amber-600 sm:text-3xl dark:text-amber-400">
                <span>Remaining</span>
                <span className="tabular-nums">{formatCurrency(remainder)}</span>
              </div>
            )}
            {remainder <= 0 && totalTendered > 0 && (
              <div className="mt-3 flex justify-between text-2xl font-bold text-emerald-600 sm:text-3xl dark:text-emerald-400">
                <span>Change</span>
                <span className="tabular-nums">
                  {formatCurrency(-remainder)}
                </span>
              </div>
            )}
          </div>

          {mpesaStkEnabled && (
            <div className="flex gap-3 rounded-xl border border-slate-200 p-2 dark:border-slate-600 sm:gap-4">
              <button
                type="button"
                onClick={() => setPaymentMode("manual")}
                className={`min-h-[56px] flex-1 rounded-xl px-4 py-3 text-xl font-bold transition sm:min-h-[60px] sm:text-2xl ${
                  paymentMode === "manual"
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
                }`}
              >
                CASH
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("stk")}
                className={`min-h-[56px] flex-1 rounded-xl px-4 py-3 text-xl font-bold text-white transition sm:min-h-[60px] sm:text-2xl ${
                  paymentMode === "stk"
                    ? "bg-[#009E52] shadow-sm ring-2 ring-[#00CC66]/60 hover:bg-[#008A47] dark:ring-white/30"
                    : "bg-[#00CC66] opacity-95 hover:bg-[#00B85C] hover:opacity-100"
                }`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Smartphone className="h-6 w-6 sm:h-7 sm:w-7" />
                  M-PESA
                </span>
              </button>
            </div>
          )}

          {sale.tenders && sale.tenders.length > 0 && (
            <div>
              <h3 className="mb-4 text-2xl font-bold text-slate-700 sm:text-3xl dark:text-slate-300">
                Payment added
              </h3>
              <ul className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-600 dark:bg-slate-700/30">
                {sale.tenders.map((t: Tender) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 text-xl font-bold text-slate-800 sm:text-2xl dark:text-white"
                  >
                    <span className="min-w-0 flex-1">
                      <span>{t.tenderTypeCode ?? "—"}</span>
                      <span className="ml-3 tabular-nums">{formatCurrency(t.amount)}</span>
                    </span>
                    <button
                      type="button"
                      disabled={isRemovingTender}
                      onClick={() => onRemoveTender(t.id)}
                      className="shrink-0 rounded-xl p-3 text-slate-500 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-600/30 dark:hover:text-red-300"
                      aria-label={`Remove ${t.tenderTypeCode ?? "payment"} ${formatCurrency(t.amount)}`}
                    >
                      <Trash2 className="h-6 w-6 sm:h-7 sm:w-7" />
                    </button>
                  </li>
                ))}
              </ul>
              {removeTenderError && (
                <p className="mt-3 text-xl font-semibold text-red-400 sm:text-2xl" role="alert">
                  {removeTenderError}
                </p>
              )}
            </div>
          )}

          {mpesaStkEnabled && paymentMode === "stk" ? (
            <div>
              <h3 className="mb-4 text-2xl font-bold text-slate-700 sm:text-3xl dark:text-slate-300">
                Pay with M-PESA
              </h3>
              {remainder <= 0 ? (
                <p className="text-xl font-bold text-slate-500 sm:text-2xl dark:text-slate-400">
                  Nothing left to pay via M-PESA.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-base font-bold text-slate-600 sm:text-lg dark:text-slate-400">
                    Amount: {formatCurrency(remainder)} (remaining balance)
                  </p>
                  <MpesaStkPhoneInput
                    orgId={orgId}
                    branchId={branchId}
                    value={stkPhone}
                    onChange={setStkPhone}
                    disabled={stkPolling || isSendingStk}
                    size="large"
                  />
                  <button
                    type="button"
                    disabled={
                      stkPolling ||
                      isSendingStk ||
                      !stkPhone.trim() ||
                      remainder <= 0
                    }
                    onClick={handleSendStk}
                    className="min-h-[56px] w-full rounded-xl bg-[#00CC66] py-3 text-xl font-bold text-white transition hover:bg-[#00B85C] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[60px] sm:text-2xl"
                  >
                    {isSendingStk ? "Sending…" : "Send M-PESA request"}
                  </button>
                  {stkPolling && (
                    <p className="mt-4 flex items-center gap-3 text-xl font-bold text-primary-600 sm:text-2xl dark:text-primary-400">
                      <Loader2 className="h-7 w-7 animate-spin sm:h-8 sm:w-8" />
                      Waiting for customer to enter PIN…
                    </p>
                  )}
                  {stkStatus && TERMINAL_STK_STATUSES.includes(stkStatus) && (
                    <p
                      className={`mt-4 text-xl font-bold sm:text-2xl ${
                        stkStatus === "SUCCESS"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500"
                      }`}
                      role="alert"
                    >
                      {stkStatus === "SUCCESS"
                        ? "M-PESA payment received."
                        : stkMessage ?? `M-PESA ${stkStatus.toLowerCase()}`}
                    </p>
                  )}
                  {stkError && (
                    <p className="mt-3 text-lg font-semibold text-red-500 sm:text-xl" role="alert">
                      {stkError}
                      {stkError.includes("not configured") && (
                        <span className="mt-2 block text-base font-semibold text-slate-500 sm:text-lg dark:text-slate-400">
                          Ask an admin to configure M-PESA in Admin → Settings.
                        </span>
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (!sale.tenders || sale.tenders.length === 0) ? (
            <div>
              <h3 className="mb-4 text-2xl font-bold text-slate-700 sm:text-3xl dark:text-slate-300">
                {cashPaymentMode ? "Add cash payment" : "Add payment"}
              </h3>
              <div
                className={`flex gap-4 ${cashPaymentMode ? "w-full flex-nowrap" : "flex-wrap sm:flex-nowrap"}`}
              >
                {!cashPaymentMode && (
                  <SearchableSelect
                    options={paymentTenderTypeOptions}
                    value={addTenderTypeId}
                    onChange={setAddTenderTypeId}
                    placeholder="Search payment type…"
                    matchOptionValue
                    className="min-h-[72px] min-w-0 flex-1 basis-full sm:basis-auto sm:min-h-[80px]"
                    controlClassName="min-h-[72px] rounded-xl border-slate-300 text-2xl font-bold focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500 dark:border-slate-600 sm:min-h-[80px] sm:text-3xl"
                    aria-label="Payment type"
                  />
                )}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addTenderAmount}
                  onChange={(e) => setAddTenderAmount(e.target.value)}
                  placeholder="Amount"
                  className={
                    cashPaymentMode
                      ? "min-h-[56px] min-w-0 flex-[2] rounded-xl border border-slate-300 bg-white px-5 py-3 text-right text-xl font-bold tabular-nums text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:min-h-[60px] sm:text-2xl dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      : "min-h-[72px] min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-5 py-3 text-right text-2xl font-bold tabular-nums text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:min-h-[80px] sm:w-44 sm:flex-none sm:text-3xl dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  }
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
                  className={
                    cashPaymentMode
                      ? "min-h-[56px] min-w-[8rem] flex-1 rounded-xl bg-primary-600 px-6 py-2.5 text-xl font-bold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[60px] sm:max-w-[14rem] sm:text-2xl"
                      : "min-h-[56px] shrink-0 rounded-xl bg-primary-600 px-5 py-2.5 text-xl font-bold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[60px] sm:px-6 sm:text-2xl"
                  }
                >
                  {isAddingTender ? "…" : "Add"}
                </button>
              </div>
              {addTenderError && (
                <p className="mt-3 text-xl font-semibold text-red-400 sm:text-2xl" role="alert">
                  {addTenderError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xl font-bold text-slate-500 sm:text-2xl dark:text-slate-400">
              Only one payment at a time. Remove the payment above to add a different one.
            </p>
          )}
        </div>
        {showPaymentFooter && (
        <div className="border-t border-slate-200 p-8 sm:p-10 dark:border-slate-600">
          {showDebtSection ? (
            <>
              <h3 className="mb-4 text-2xl font-bold text-slate-700 sm:text-3xl dark:text-slate-300">
                Record balance as debt
              </h3>
              <p className="mb-4 text-xl font-bold text-slate-600 sm:text-2xl dark:text-slate-400">
                Capture customer details to record {formatCurrency(remainder)} as debt.
              </p>
              <div className="mb-4 space-y-3">
                <input
                  type="text"
                  required
                  value={debtCustomerName}
                  onChange={(e) => setDebtCustomerName(e.target.value)}
                  placeholder="Customer name *"
                  className="min-h-[72px] w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-2xl font-semibold text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:min-h-[80px] sm:text-3xl dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  aria-label="Customer name"
                />
                <input
                  type="tel"
                  value={debtCustomerPhone}
                  onChange={(e) => setDebtCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className="min-h-[72px] w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-2xl font-semibold text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:min-h-[80px] sm:text-3xl dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  aria-label="Customer phone"
                />
                <DateInput
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  className="min-h-[72px] w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-2xl font-semibold text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:min-h-[80px] sm:text-3xl dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
                className="min-h-[56px] w-full rounded-xl bg-amber-600 py-3 text-xl font-bold text-white transition hover:bg-amber-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[60px] sm:text-2xl dark:hover:bg-amber-500"
              >
                {isCompletingWithDebt ? "Processing…" : "Complete with balance as debt"}
              </button>
              {completeWithDebtError && (
                <p className="mt-3 text-xl font-semibold text-red-400 sm:text-2xl" role="alert">
                  {completeWithDebtError}
                </p>
              )}
            </>
          ) : showCompleteSale ? (
            <>
              <button
                type="button"
                disabled={isCompleting}
                onClick={onComplete}
                className="min-h-[56px] w-full rounded-xl bg-emerald-600 py-3 text-xl font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[60px] sm:text-2xl dark:hover:bg-emerald-500"
              >
                {isCompleting ? "Completing…" : "Complete sale"}
              </button>
              {completeError && (
                <p className="mt-3 text-xl font-semibold text-red-400 sm:text-2xl" role="alert">
                  {completeError}
                </p>
              )}
            </>
          ) : completeError ? (
            <p className="text-xl font-semibold text-red-400 sm:text-2xl" role="alert">
              {completeError}
            </p>
          ) : null}
        </div>
        )}
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
      ? Math.max(0, stockOnHand)
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
            {formatQty(line.qty)}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAddMore}
            title={
              !canAddMore && maxQty !== undefined
                ? `Only ${formatQty(maxQty)} in stock`
                : undefined
            }
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-r-xl text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-600"
            aria-label={
              canAddMore
                ? `Increase quantity of ${line.itemName}`
                : `Cannot add more; ${formatQty(maxQty ?? 0)} in stock`
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
