import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchCategories } from "@/api/categories";
import { fetchModifierGroups } from "@/api/modifierGroups";
import {
  fetchItems,
  fetchAllOrgItems,
  fetchItem,
  createItem,
  updateItem,
  deleteItem,
  uploadItemImage,
  fetchItemBarcodes,
  addItemBarcode,
  deleteItemBarcode,
  fetchItemModifierGroups,
  addItemModifierGroup,
  deleteItemModifierGroup,
} from "@/api/items";
import type { Org } from "@/types/org";
import { filterActiveOrgs } from "@/types/org";
import type { Item } from "@/types/catalog";
import type { Category } from "@/types/catalog";
import type { ItemModifierGroupLink } from "@/types/catalog";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  IconButton,
  SlideOver,
  Pagination,
  ConfirmDialog,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  TableSearchInput,
  TableSkeleton,
  FormLabel,
  tableBodyRow,
  tableBodyRowZebra,
  tableStickyHeadCell,
  tableStickyFirstBody,
  tableEmptyCell,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useDataTable } from "@/hooks/useDataTable";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { formatAmount } from "@/utils/formatCurrency";
import { downloadItemsPdf } from "@/utils/itemsPdf";
import { filterRowsBySearch } from "@/utils/tableSearchMatch";
import { sortTableRows } from "@/utils/tableSort";
import { getItemImageUrl, getItemImageName } from "@/utils/itemImage";
import { resizeImageTo400x400 } from "@/utils/imageResize";
import { Plus, Pencil, Trash2, Upload, ChevronDown, Download, Loader2, Info } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { useFormCustomization } from "@/contexts/FormCustomizationContext";
import { useTableCustomization } from "@/contexts/TableCustomizationContext";
import { BARCODE_ITEMS, isBarcodeVisible } from "@/config/barcodeVisibility";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;
const ITEMS_FETCH_PAGE_SIZE = 500;
const ITEM_TYPES = ["STOCK", "SERVICE", "MENU", "BUNDLE"] as const;
const ITEM_SORT = {
  name: (row: Item) => row.name,
  sku: (row: Item) => row.sku ?? "",
  barcode: (row: Item) => row.barcode ?? "",
  itemType: (row: Item) => row.itemType,
  active: (row: Item) => (row.active ? 1 : 0),
  buyingPrice: (row: Item) => row.buyingPrice ?? Number.NEGATIVE_INFINITY,
  defaultSellingPrice: (row: Item) => row.defaultSellingPrice ?? Number.NEGATIVE_INFINITY,
};

export interface ItemsListPageProps {
  initialOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

export function ItemsListPage({ initialOrgId, onOrgChange }: ItemsListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const navContext = useNavVisibilityContextOrNull();
  const showBarcode = isBarcodeVisible(
    navContext?.adminVisibility ?? {},
    BARCODE_ITEMS
  );
  const formCustom = useFormCustomization("item");
  const itemGridKeys = useMemo(
    () => [
      "name",
      "sku",
      ...(showBarcode ? ["barcode"] : []),
      "itemType",
      "category",
      "buyingPrice",
      "sellingPrice",
    ],
    [showBarcode]
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [categoryFilterQuery, setCategoryFilterQuery] = useState("");
  const categoryFilterRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        categoryFilterOpen &&
        categoryFilterRef.current &&
        !categoryFilterRef.current.contains(e.target as Node)
      ) {
        setCategoryFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [categoryFilterOpen]);
  const tableCustom = useTableCustomization("items");
  const [size, setSize] = useState(tableCustom.pageSize || DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (tableCustom.pageSize && tableCustom.pageSize > 0) {
      setSize(tableCustom.pageSize);
    }
  }, [tableCustom.pageSize]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formItemType, setFormItemType] = useState<string>("MENU");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formTaxProfileId, setFormTaxProfileId] = useState("");
  const [formBuyingPrice, setFormBuyingPrice] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formVisibleInPos, setFormVisibleInPos] = useState(true);
  const [formTrackInventory, setFormTrackInventory] = useState(true);
  const [formActive, setFormActive] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [formBarcode, setFormBarcode] = useState("");
  const [newModifierGroupId, setNewModifierGroupId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const isItemFormValid = useMemo(() => {
    if (formCustom.isFieldVisible("name") && formCustom.isFieldRequired("name", true) && !formName.trim()) return false;
    if (formCustom.isFieldVisible("sku") && formCustom.isFieldRequired("sku", true) && !formSku.trim()) return false;
    if (formCustom.isFieldVisible("category") && formCustom.isFieldRequired("category", false) && !formCategoryId) return false;
    if (formCustom.isFieldVisible("barcode") && formCustom.isFieldRequired("barcode", false) && !formBarcode.trim()) return false;
    if (formCustom.isFieldVisible("buyingPrice") && formCustom.isFieldRequired("buyingPrice", false) && !formBuyingPrice.trim()) return false;
    if (formCustom.isFieldVisible("sellingPrice") && formCustom.isFieldRequired("sellingPrice", false) && !formSellingPrice.trim()) return false;
    return true;
  }, [formName, formSku, formCategoryId, formBarcode, formBuyingPrice, formSellingPrice, formCustom]);
  const [priceWarning, setPriceWarning] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [inlineUploadingItemId, setInlineUploadingItemId] = useState<string | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);
  const inlineUploadItemRef = useRef<Item | null>(null);
  const [editingPriceCell, setEditingPriceCell] = useState<{
    itemId: string;
    field: "buyingPrice" | "defaultSellingPrice";
    value: string;
  } | null>(null);
  const [savingPriceItemId, setSavingPriceItemId] = useState<string | null>(null);

  async function handleSavePriceCell(item: Item) {
    if (!editingPriceCell) return;
    const raw = editingPriceCell.value.trim();
    const error = validatePriceCellValue(item, editingPriceCell.field, raw);
    if (error) return;
    const parsed = raw === "" ? null : Number(raw);
    const currentValue =
      editingPriceCell.field === "buyingPrice"
        ? item.buyingPrice
        : item.defaultSellingPrice;
    if (parsed === currentValue) {
      setEditingPriceCell(null);
      return;
    }
    const nextBuying =
      editingPriceCell.field === "buyingPrice" ? parsed : item.buyingPrice;
    const nextSelling =
      editingPriceCell.field === "defaultSellingPrice"
        ? parsed
        : item.defaultSellingPrice;
    setSavingPriceItemId(item.id);
    try {
      await updateItem(token, selectedOrgId, item.id, {
        sku: item.sku,
        name: item.name,
        itemType: item.itemType,
        categoryId: item.categoryId,
        taxProfileId: item.taxProfileId,
        trackInventory: item.trackInventory,
        active: item.active,
        buyingPrice: nextBuying,
        defaultSellingPrice: nextSelling,
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-items", token, selectedOrgId],
      });
      queryClient.invalidateQueries({ queryKey: ["items", selectedOrgId] });
      toast.success("Price updated.", { title: "Saved" });
      setEditingPriceCell(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSavingPriceItemId(null);
    }
  }

  async function handleInlineImageUpload(file: File, item: Item) {
    if (!token || !selectedOrgId) return;
    setInlineUploadingItemId(item.id);
    try {
      const { url } = await uploadItemImage(token, selectedOrgId, file);
      await updateItem(token, selectedOrgId, item.id, {
        sku: item.sku,
        name: item.name,
        itemType: item.itemType,
        categoryId: item.categoryId,

        taxProfileId: item.taxProfileId,
        trackInventory: item.trackInventory,
        active: item.active,
        buyingPrice: item.buyingPrice,
        defaultSellingPrice: item.defaultSellingPrice,
        imageUrl: url,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-items", token, selectedOrgId] });
      queryClient.invalidateQueries({ queryKey: ["items", selectedOrgId] });
      toast.success("Image updated.", { title: "Saved" });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setInlineUploadingItemId(null);
    }
  }

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const itemsQuery = useQuery({
    queryKey: [
      "admin-items",
      token,
      selectedOrgId,
      selectedCategoryId || null,
    ],
    queryFn: () =>
      fetchItems(token, selectedOrgId, {
        page: 0,
        size: ITEMS_FETCH_PAGE_SIZE,
        categoryId: selectedCategoryId || undefined,
      }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });
  const { data: itemsData, isError, error, refetch } = itemsQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(itemsQuery);

  const { data: categoriesData } = useQuery({
    queryKey: ["admin-categories", token, selectedOrgId],
    queryFn: () => fetchCategories(token, selectedOrgId, { size: 500 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: modifierGroupsData } = useQuery({
    queryKey: ["admin-modifier-groups", token, selectedOrgId],
    queryFn: () => fetchModifierGroups(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const { data: editingItemData } = useQuery({
    queryKey: ["admin-item", token, selectedOrgId, editingItem?.id],
    queryFn: () => fetchItem(token, selectedOrgId, editingItem!.id),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(editingItem) &&
      slideOpen,
  });

  const { data: barcodesData } = useQuery({
    queryKey: ["admin-item-barcodes", token, selectedOrgId, editingItem?.id],
    queryFn: () =>
      fetchItemBarcodes(token, selectedOrgId, editingItem!.id),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(editingItem) &&
      slideOpen,
  });

  const { data: itemModifierGroupsData } = useQuery({
    queryKey: [
      "admin-item-modifier-groups",
      token,
      selectedOrgId,
      editingItem?.id,
    ],
    queryFn: () =>
      fetchItemModifierGroups(token, selectedOrgId, editingItem!.id),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(editingItem) &&
      slideOpen,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      sku: string | null;
      name: string;
      itemType: string;
      categoryId: string | null;

      taxProfileId: string | null;
      trackInventory: boolean;
      active: boolean;
      buyingPrice: number | null;
      defaultSellingPrice: number | null;
      visibleInPos?: boolean;
      imageUrl: string | null;
    }) => createItem(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-items", token, selectedOrgId],
      });
      queryClient.invalidateQueries({ queryKey: ["items", selectedOrgId] });
      setSlideOpen(false);
      setEditingItem(null);
      resetForm();
      toast.success("Item created.", { title: "Created" });
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
      itemId: string;
      sku: string | null;
      name: string;
      itemType: string;
      categoryId: string | null;

      taxProfileId: string | null;
      trackInventory: boolean;
      active: boolean;
      buyingPrice: number | null;
      defaultSellingPrice: number | null;
      visibleInPos?: boolean;
      imageUrl: string | null;
    }) =>
      updateItem(token, selectedOrgId, body.itemId, {
        sku: body.sku,
        name: body.name,
        itemType: body.itemType,
        categoryId: body.categoryId,

        taxProfileId: body.taxProfileId,
        trackInventory: body.trackInventory,
        active: body.active,
        buyingPrice: body.buyingPrice,
        defaultSellingPrice: body.defaultSellingPrice,
        visibleInPos: body.visibleInPos,
        imageUrl: body.imageUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-items", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-item", token, selectedOrgId, editingItem?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["items", selectedOrgId] });
      setSubmitLoading(false);
      toast.success("Item updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const addModifierGroupMutation = useMutation({
    mutationFn: (modifierGroupId: string) =>
      addItemModifierGroup(token, selectedOrgId, editingItem!.id, modifierGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "admin-item-modifier-groups",
          token,
          selectedOrgId,
          editingItem?.id,
        ],
      });
      setNewModifierGroupId("");
      toast.success("Modifier group linked.", { title: "Added" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteModifierGroupMutation = useMutation({
    mutationFn: (linkId: string) =>
      deleteItemModifierGroup(token, selectedOrgId, editingItem!.id, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "admin-item-modifier-groups",
          token,
          selectedOrgId,
          editingItem?.id,
        ],
      });
      toast.success("Modifier group unlinked.", { title: "Removed" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      deleteItem(token, selectedOrgId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-items", token, selectedOrgId],
      });
      queryClient.invalidateQueries({ queryKey: ["items", selectedOrgId] });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Item deleted.", { title: "Deleted" });
    },
    onError: (err) => {
      setDeleteLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const items = (itemsData?.content ?? []).filter((i: Item) => i.active);
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: pagedItems,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(items, undefined, {
    page,
    size,
    setPage,
    sortAccessors: ITEM_SORT,
  });

  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedCategoryId, selectedOrgId, size]);

  const categories = categoriesData?.content ?? [];
  const modifierGroups = modifierGroupsData?.content ?? [];
  const barcodes = barcodesData ?? [];
  const itemModifierGroups = itemModifierGroupsData ?? [];
  const assignedModifierGroupIds = new Set(
    itemModifierGroups.map((l: ItemModifierGroupLink) => l.modifierGroupId)
  );
  const availableModifierGroups = modifierGroups.filter(
    (mg: { id: string }) => !assignedModifierGroupIds.has(mg.id)
  );

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((o: Org) => ({ value: o.id, label: o.name })),
    ],
    [orgs]
  );

  const itemTypeOptions = useMemo(
    () => ITEM_TYPES.map((t) => ({ value: t, label: t })),
    []
  );

  const itemCategoryOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...categories.map((c: Category) => ({ value: c.id, label: c.name })),
    ],
    [categories]
  );

  const modifierGroupAddOptions = useMemo(
    () => [
      { value: "", label: "Select modifier group…" },
      ...availableModifierGroups.map((mg: { id: string; name: string }) => ({
        value: mg.id,
        label: mg.name,
      })),
    ],
    [availableModifierGroups]
  );

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  useEffect(() => {
    if (editingItemData) {
      setFormSku(editingItemData.sku ?? "");
      setFormName(editingItemData.name);
      setFormItemType(editingItemData.itemType);
      setFormCategoryId(editingItemData.categoryId ?? "");

      setFormTaxProfileId(editingItemData.taxProfileId ?? "");
      setFormBuyingPrice(
        editingItemData.buyingPrice != null ? String(editingItemData.buyingPrice) : ""
      );
      setFormSellingPrice(
        editingItemData.defaultSellingPrice != null
          ? String(editingItemData.defaultSellingPrice)
          : ""
      );
      setFormVisibleInPos(editingItemData.visibleInPos ?? true);
      setFormTrackInventory(editingItemData.trackInventory);
      setFormActive(editingItemData.active);
      setFormImageUrl(editingItemData.primaryImageUrl ?? "");
    }
  }, [editingItemData]);

  useEffect(() => {
    if (editingItem && barcodesData !== undefined) {
      setFormBarcode(barcodesData?.[0]?.barcode ?? "");
    }
  }, [editingItem, barcodesData]);

  function resetForm() {
    setFormSku("");
    setFormName("");
    setFormItemType("MENU");
    setFormCategoryId("");

    setFormTaxProfileId("");
    setFormBuyingPrice("");
    setFormSellingPrice("");
    setFormVisibleInPos(true);
    setFormTrackInventory(true);
    setFormActive(true);
    setFormImageUrl("");
    setFormBarcode("");
    setFormError(null);
    setPriceWarning("");
    setNewModifierGroupId("");
  }

  const openCreate = () => {
    setEditingItem(null);
    resetForm();
    setSlideOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setFormError(null);
    setFormBarcode("");
    setNewModifierGroupId("");
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditingItem(null);
    setFormError(null);
    setPriceWarning("");
  };

  // Debounced inline price validation (600ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      const buying = formBuyingPrice ? parseFloat(formBuyingPrice) : null;
      const selling = formSellingPrice ? parseFloat(formSellingPrice) : null;
      if (
        buying != null &&
        !isNaN(buying) &&
        selling != null &&
        !isNaN(selling) &&
        selling <= buying
      ) {
        setPriceWarning("Selling price must be greater than buying price.");
      } else {
        setPriceWarning("");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [formBuyingPrice, formSellingPrice]);

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError("Name is required.");
      return;
    }
    const trimmedSku = formSku.trim();
    if (!trimmedSku) {
      setFormError("SKU is required.");
      return;
    }
    const sellingPriceNum = formSellingPrice ? parseFloat(formSellingPrice) : null;
    const buyingPriceNum = formBuyingPrice ? parseFloat(formBuyingPrice) : null;
    if (buyingPriceNum == null || isNaN(buyingPriceNum) || buyingPriceNum < 0) {
      setFormError("Buying price is required and must be a valid amount.");
      return;
    }
    if (sellingPriceNum == null || isNaN(sellingPriceNum) || sellingPriceNum <= 0) {
      setFormError("Selling price is required and must be greater than 0.");
      return;
    }
    if (sellingPriceNum <= buyingPriceNum) {
      setFormError("Selling price must be greater than buying price.");
      return;
    }
    const payload = {
      sku: trimmedSku,
      name: trimmed,
      itemType: formItemType,
      categoryId: formCategoryId || null,

      taxProfileId: formTaxProfileId || null,
      trackInventory: formTrackInventory,
      active: formActive,
      buyingPrice: buyingPriceNum,
      defaultSellingPrice: sellingPriceNum,

      visibleInPos: formVisibleInPos,
      imageUrl: formImageUrl.trim() || null,
    };
    setSubmitLoading(true);
    if (editingItem) {
      (async () => {
        try {
          await updateMutation.mutateAsync({
            ...payload,
            itemId: editingItem.id,
          });
          if (showBarcode) {
            const desiredBarcode = formBarcode.trim();
            const currentBarcodes = barcodes;
            for (const b of currentBarcodes) {
              await deleteItemBarcode(token, selectedOrgId, editingItem.id, b.id);
            }
            if (desiredBarcode) {
              await addItemBarcode(token, selectedOrgId, editingItem.id, desiredBarcode);
            }
          }
          queryClient.invalidateQueries({
            queryKey: ["admin-items", token, selectedOrgId],
          });
          queryClient.invalidateQueries({
            queryKey: ["admin-item-barcodes", token, selectedOrgId, editingItem.id],
          });
          queryClient.invalidateQueries({ queryKey: ["items", selectedOrgId] });
          setSlideOpen(false);
          setEditingItem(null);
          resetForm();
        } catch (err: unknown) {
          const requestId = getApiErrorRequestId(err);
          toast.error(getApiErrorMessage(err), {
            detail: requestId ? `Reference: ${requestId}` : undefined,
          });
        } finally {
          setSubmitLoading(false);
        }
      })();
    } else {
      (async () => {
        try {
          const created = await createMutation.mutateAsync(payload);
          queryClient.invalidateQueries({
            queryKey: ["admin-items", token, selectedOrgId],
          });
          queryClient.invalidateQueries({ queryKey: ["items", selectedOrgId] });
          setSlideOpen(false);
          setEditingItem(null);
          resetForm();
          toast.success("Item created.", { title: "Created" });
          if (showBarcode) {
            const barcodeToAdd = formBarcode.trim();
            if (barcodeToAdd && token && selectedOrgId) {
            try {
              await addItemBarcode(token, selectedOrgId, created.id, barcodeToAdd);
              queryClient.invalidateQueries({
                queryKey: ["admin-item-barcodes", token, selectedOrgId, created.id],
              });
              queryClient.invalidateQueries({
                queryKey: ["admin-items", token, selectedOrgId],
              });
              toast.success("Barcode added to item.", { title: "Barcode" });
            } catch (barcodeErr) {
              toast.error(
                `Barcode could not be added: ${getApiErrorMessage(barcodeErr)}`,
                { detail: getApiErrorRequestId(barcodeErr) ? `Reference: ${getApiErrorRequestId(barcodeErr)}` : undefined }
              );
            }
            }
          }
        } catch (err) {
          const requestId = getApiErrorRequestId(err);
          toast.error(getApiErrorMessage(err), {
            detail: requestId ? `Reference: ${requestId}` : undefined,
          });
        } finally {
          setSubmitLoading(false);
        }
      })();
    }
  };

  const handleAddModifierGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModifierGroupId || !editingItem) return;
    addModifierGroupMutation.mutate(newModifierGroupId);
  };

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  const handleDeleteConfirm = () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    deleteItemMutation.mutate(confirmDelete.id);
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!token || !selectedOrgId) return;
    setDownloadingPdf(true);
    try {
      const allItems = await fetchAllOrgItems(token, selectedOrgId);
      let exportItems = allItems.filter((i: Item) => i.active);
      if (selectedCategoryId) {
        exportItems = exportItems.filter((i: Item) => i.categoryId === selectedCategoryId);
      }
      if (searchQuery.trim()) {
        exportItems = filterRowsBySearch(exportItems, searchQuery, undefined, ITEM_SORT);
      }
      if (sortColumn && sortDirection) {
        exportItems = sortTableRows(
          exportItems,
          { column: sortColumn, direction: sortDirection },
          (row, column) => ITEM_SORT[column as keyof typeof ITEM_SORT]?.(row) ?? null
        );
      }
      if (exportItems.length === 0) {
        toast.error("No items matching the selected filters to export.");
        return;
      }
      const orgName = orgs.find((o) => o.id === selectedOrgId)?.name ?? "Organization";
      const pdfOptions: {
        orgName?: string | null;
        categoryLabel?: string;
        searchQuery?: string;
        preserveOrder?: boolean;
      } = { orgName };
      if (selectedCategoryId) {
        pdfOptions.categoryLabel = selectedCategoryLabel;
      }
      if (searchQuery.trim()) {
        pdfOptions.searchQuery = searchQuery.trim();
      }
      if (sortColumn && sortDirection) {
        pdfOptions.preserveOrder = true;
      }
      downloadItemsPdf(exportItems, pdfOptions);
      toast.success("PDF downloaded.", { title: "Items list" });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const categoryName = (id: string | null) =>
    id ? categories.find((c: Category) => c.id === id)?.name ?? id : "—";

  const filteredCategoriesForDropdown = useMemo(() => {
    const q = categoryFilterQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c: Category) =>
      c.name.toLowerCase().includes(q)
    );
  }, [categories, categoryFilterQuery]);

  const selectedCategoryLabel = selectedCategoryId
    ? categoryName(selectedCategoryId)
    : "All categories";

  const modifierGroupName = (modifierGroupId: string) =>
    modifierGroups.find((mg: { id: string; name: string }) => mg.id === modifierGroupId)
      ?.name ?? modifierGroupId;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Items"
        subtitle="Catalog items: products, menu items, and services. Add barcodes and modifier groups when editing."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {orgs.length > 1 && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="item-org-select"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Organization
              </label>
              <SearchableSelect
                id="item-org-select"
                options={orgSelectOptions}
                value={selectedOrgId}
                onChange={(next) => {
                  setSelectedOrgId(next);
                  setSelectedCategoryId("");
                  setPage(0);
                  onOrgChange?.(next);
                }}
                placeholder="Search organization…"
                className="w-full sm:w-56"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
          )}
          {selectedOrgId && (
            <>
              <div ref={categoryFilterRef} className="relative">
                <label
                  htmlFor="item-category-filter"
                  className="sr-only"
                >
                  Category filter
                </label>
                <input
                  id="item-category-filter"
                  type="text"
                  value={categoryFilterOpen ? categoryFilterQuery : selectedCategoryLabel}
                  onChange={(e) => setCategoryFilterQuery(e.target.value)}
                  onFocus={() => {
                    setCategoryFilterOpen(true);
                    setCategoryFilterQuery("");
                  }}
                  readOnly={!categoryFilterOpen}
                  placeholder="Filter by category…"
                  autoComplete="off"
                  data-form-type="other"
                  className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCategoryFilterOpen((o) => !o)
                  }
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600"
                  aria-label="Toggle category filter"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition ${categoryFilterOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {categoryFilterOpen && (
                  <ul
                    className="absolute left-0 top-full z-20 mt-1 max-h-60 w-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
                    role="listbox"
                  >
                    <li
                      role="option"
                      aria-selected={!selectedCategoryId}
                      onClick={() => {
                        setSelectedCategoryId("");
                        setCategoryFilterOpen(false);
                        setCategoryFilterQuery("");
                        setPage(0);
                      }}
                      className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        !selectedCategoryId
                          ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      All categories
                    </li>
                    {filteredCategoriesForDropdown.map((c: Category) => (
                      <li
                        key={c.id}
                        role="option"
                        aria-selected={selectedCategoryId === c.id}
                        onClick={() => {
                          setSelectedCategoryId(c.id);
                          setCategoryFilterOpen(false);
                          setCategoryFilterQuery("");
                          setPage(0);
                        }}
                        className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                          selectedCategoryId === c.id
                            ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {c.name}
                      </li>
                    ))}
                    {filteredCategoriesForDropdown.length === 0 && (
                      <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                        No categories match
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <TableSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search items…"
                className="w-full sm:w-64"
              />
            </>
          )}
        </div>
        {selectedOrgId && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || !selectedOrgId}
              title="Download PDF document of all items"
              aria-label="Download"
              className="flex items-center gap-1.5"
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>Download</span>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage items.
        </div>
      ) : (
        <>
          {isError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              <p>{getApiErrorMessage(error)}</p>
              {getApiErrorRequestId(error) && (
                <p className="mt-2 text-sm opacity-90">
                  Reference:{" "}
                  <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                    {getApiErrorRequestId(error)}
                  </code>
                </p>
              )}
            </div>
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "1000px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    {tableCustom.showRowNumbers && (
                      <TableRowNumberHead className={tableCustom.densityStyles.th} />
                    )}
                    {tableCustom.visibleColumns.map((col) => {
                      const isSticky = col.key === "name";
                      return (
                        <SortableTableHead
                          key={col.key}
                          columnKey={col.key}
                          label={col.label}
                          align={col.align}
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={toggleSort}
                          sortable={col.sortable}
                          className={`${isSticky ? tableStickyHeadCell : ""} ${tableCustom.densityStyles.th}`}
                        />
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {isInitialLoad ? (
                    <TableSkeleton
                      rows={size}
                      columns={(tableCustom.showRowNumbers ? 1 : 0) + tableCustom.visibleColumns.length}
                    />
                  ) : pagedItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={(tableCustom.showRowNumbers ? 1 : 0) + tableCustom.visibleColumns.length}
                        className={tableEmptyCell}
                      >
                        {items.length === 0 ? "No items yet. Add one to build your catalog." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    pagedItems.map((item: Item, index) => {
                      const isEven = index % 2 === 1;
                      const zebraClass =
                        tableCustom.zebraStriping && isEven
                          ? tableBodyRowZebra
                          : "";
                      return (
                        <tr
                          key={item.id}
                          className={`${tableBodyRow} ${zebraClass}`}
                        >
                          {tableCustom.showRowNumbers && (
                            <TableRowNumberCell
                              page={page}
                              pageSize={size}
                              indexInPage={index}
                              className={tableCustom.densityStyles.td}
                            />
                          )}
                          {tableCustom.visibleColumns.map((col) => {
                            switch (col.key) {
                              case "name":
                                return (
                                  <td
                                    key={col.key}
                                    className={`${tableStickyFirstBody} ${tableCustom.densityStyles.td}`}
                                  >
                                    {item.name}
                                  </td>
                                );
                              case "sku":
                                return (
                                  <td key={col.key} className={tableCustom.densityStyles.td}>
                                    {item.sku ?? "—"}
                                  </td>
                                );
                              case "barcode":
                                return (
                                  <td key={col.key} className={`${tableCustom.densityStyles.td} font-mono`}>
                                    {item.barcode ?? "—"}
                                  </td>
                                );
                              case "itemType":
                                return (
                                  <td key={col.key} className={tableCustom.densityStyles.td}>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                      {item.itemType}
                                    </span>
                                  </td>
                                );
                              case "active":
                                return (
                                  <td key={col.key} className={tableCustom.densityStyles.td}>
                                    <Badge variant={item.active ? "success" : "neutral"}>
                                      {item.active ? "Yes" : "No"}
                                    </Badge>
                                  </td>
                                );
                              case "buyingPrice":
                                return (
                                  <td
                                    key={col.key}
                                    className={
                                      col.align === "right"
                                        ? tableCustom.densityStyles.tdNum
                                        : tableCustom.densityStyles.td
                                    }
                                  >
                                    <PriceCell
                                      item={item}
                                      field="buyingPrice"
                                      editing={editingPriceCell}
                                      saving={savingPriceItemId === item.id}
                                      onStartEdit={(value) =>
                                        setEditingPriceCell({
                                          itemId: item.id,
                                          field: "buyingPrice",
                                          value,
                                        })
                                      }
                                      onChange={(value) =>
                                        setEditingPriceCell((prev) =>
                                          prev ? { ...prev, value } : prev
                                        )
                                      }
                                      onCommit={() => handleSavePriceCell(item)}
                                      onCancel={() => setEditingPriceCell(null)}
                                    />
                                  </td>
                                );
                              case "sellingPrice":
                                return (
                                  <td
                                    key={col.key}
                                    className={
                                      col.align === "right"
                                        ? tableCustom.densityStyles.tdNum
                                        : tableCustom.densityStyles.td
                                    }
                                  >
                                    <PriceCell
                                      item={item}
                                      field="defaultSellingPrice"
                                      editing={editingPriceCell}
                                      saving={savingPriceItemId === item.id}
                                      onStartEdit={(value) =>
                                        setEditingPriceCell({
                                          itemId: item.id,
                                          field: "defaultSellingPrice",
                                          value,
                                        })
                                      }
                                      onChange={(value) =>
                                        setEditingPriceCell((prev) =>
                                          prev ? { ...prev, value } : prev
                                        )
                                      }
                                      onCommit={() => handleSavePriceCell(item)}
                                      onCancel={() => setEditingPriceCell(null)}
                                    />
                                  </td>
                                );
                              case "image":
                                return (
                                  <td key={col.key} className={tableCustom.densityStyles.td}>
                                    <button
                                      type="button"
                                      disabled={inlineUploadingItemId === item.id}
                                      onClick={() => {
                                        inlineUploadItemRef.current = item;
                                        inlineFileInputRef.current?.click();
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                                      title={item.primaryImageUrl ? `Image: ${item.primaryImageUrl}` : "Upload image"}
                                    >
                                      {inlineUploadingItemId === item.id ? (
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
                                      ) : (
                                        <Upload className="h-3.5 w-3.5" />
                                      )}
                                      {item.primaryImageUrl ? getItemImageName(item.primaryImageUrl) : "Upload"}
                                    </button>
                                  </td>
                                );
                              case "actions":
                                return (
                                  <td key={col.key} className={tableCustom.densityStyles.td}>
                                    <div className="flex justify-start gap-2">
                                      <IconButton
                                        onClick={() => openEdit(item)}
                                        title={`Edit ${item.name}`}
                                        aria-label={`Edit ${item.name}`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </IconButton>
                                      <IconButton
                                        variant="danger"
                                        onClick={() => setConfirmDelete(item)}
                                        title={`Delete ${item.name}`}
                                        aria-label={`Delete ${item.name}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </IconButton>
                                    </div>
                                  </td>
                                );
                              default:
                                return (
                                  <td key={col.key} className={tableCustom.densityStyles.td}>
                                    —
                                  </td>
                                );
                            }
                          })}
                        </tr>
                      );
                    })
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
                sizeOptions={[10, 15, 25, 50, 100]}
                onRefresh={() => void refetch()}
                isRefreshing={isRefreshing}
              />
            )}
          </div>

          <SlideOver
            open={slideOpen}
            onClose={closeSlide}
            title={editingItem ? "Edit item" : "Add item"}
          >
            <form onSubmit={handleItemSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formCustom.isFieldVisible("name") && (
                  <div style={{ order: formCustom.getFieldOrder("name") }} className={formCustom.getFieldColSpan("name", itemGridKeys)}>
                    <FormLabel
                      htmlFor="item-name"
                      className="mb-1"
                      required={formCustom.isFieldRequired("name", true)}
                    >
                      {formCustom.getFieldLabel("name", "Name")}
                    </FormLabel>
                    <input
                      id="item-name"
                      type="text"
                      required={formCustom.isFieldRequired("name", true)}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      placeholder={formCustom.getFieldPlaceholder("name", "e.g. Coca Cola 500ml")}
                      autoFocus
                    />
                  </div>
                )}

                {formCustom.isFieldVisible("sku") && (
                  <div style={{ order: formCustom.getFieldOrder("sku") }} className={formCustom.getFieldColSpan("sku", itemGridKeys)}>
                    <FormLabel
                      htmlFor="item-sku"
                      className="mb-1"
                      required={formCustom.isFieldRequired("sku", true)}
                    >
                      {formCustom.getFieldLabel("sku", "SKU")}
                    </FormLabel>
                    <input
                      id="item-sku"
                      type="text"
                      required={formCustom.isFieldRequired("sku", true)}
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      placeholder={formCustom.getFieldPlaceholder("sku", "e.g. BEV-001")}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                )}

                {showBarcode && formCustom.isFieldVisible("barcode") && (
                  <div style={{ order: formCustom.getFieldOrder("barcode") }} className={formCustom.getFieldColSpan("barcode", itemGridKeys)}>
                    <FormLabel
                      htmlFor="item-barcode"
                      className="mb-1"
                      required={formCustom.isFieldRequired("barcode", false)}
                    >
                      {formCustom.getFieldLabel("barcode", "Barcode")}
                    </FormLabel>
                    <input
                      id="item-barcode"
                      type="text"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      placeholder={formCustom.getFieldPlaceholder("barcode", "e.g. 5901234123457 or scan")}
                      autoComplete="off"
                    />
                  </div>
                )}

                {formCustom.isFieldVisible("itemType") && (
                  <div style={{ order: formCustom.getFieldOrder("itemType") }} className={formCustom.getFieldColSpan("itemType", itemGridKeys)}>
                    <FormLabel
                      htmlFor="item-type"
                      className="mb-1"
                      required={formCustom.isFieldRequired("itemType", false)}
                    >
                      {formCustom.getFieldLabel("itemType", "Type")}
                    </FormLabel>
                    <SearchableSelect
                      id="item-type"
                      options={itemTypeOptions}
                      value={formItemType}
                      onChange={setFormItemType}
                      placeholder={formCustom.getFieldPlaceholder("itemType", "Search type…")}
                      className="w-full"
                      controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                    />
                  </div>
                )}

                {formCustom.isFieldVisible("category") && (
                  <div style={{ order: formCustom.getFieldOrder("category") }} className={formCustom.getFieldColSpan("category", itemGridKeys)}>
                    <FormLabel
                      htmlFor="item-category"
                      className="mb-1"
                      required={formCustom.isFieldRequired("category", false)}
                    >
                      {formCustom.getFieldLabel("category", "Category")}
                    </FormLabel>
                    <SearchableSelect
                      id="item-category"
                      options={itemCategoryOptions}
                      value={formCategoryId}
                      onChange={setFormCategoryId}
                      placeholder={formCustom.getFieldPlaceholder("category", "Search category…")}
                      className="w-full"
                      controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                    />
                  </div>
                )}

                {formCustom.isFieldVisible("buyingPrice") && (
                  <div style={{ order: formCustom.getFieldOrder("buyingPrice") }} className={formCustom.getFieldColSpan("buyingPrice", itemGridKeys)}>
                    <FormLabel
                      htmlFor="item-buying-price"
                      className="mb-1"
                      required={formCustom.isFieldRequired("buyingPrice", true)}
                    >
                      {formCustom.getFieldLabel("buyingPrice", "Buying price")}
                    </FormLabel>
                    <input
                      id="item-buying-price"
                      type="number"
                      step="0.01"
                      min="0"
                      required={formCustom.isFieldRequired("buyingPrice", true)}
                      value={formBuyingPrice}
                      onChange={(e) => setFormBuyingPrice(e.target.value)}
                      placeholder={formCustom.getFieldPlaceholder("buyingPrice", "0.00")}
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                )}

                {formCustom.isFieldVisible("sellingPrice") && (
                  <div style={{ order: formCustom.getFieldOrder("sellingPrice") }} className={formCustom.getFieldColSpan("sellingPrice", itemGridKeys)}>
                    <FormLabel
                      htmlFor="item-selling-price"
                      className="mb-1"
                      required={formCustom.isFieldRequired("sellingPrice", true)}
                    >
                      {formCustom.getFieldLabel("sellingPrice", "Selling price")}
                    </FormLabel>
                    <input
                      id="item-selling-price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required={formCustom.isFieldRequired("sellingPrice", true)}
                      value={formSellingPrice}
                      onChange={(e) => setFormSellingPrice(e.target.value)}
                      placeholder={formCustom.getFieldPlaceholder("sellingPrice", "0.00")}
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                )}
              </div>
              {priceWarning && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {priceWarning}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <div className="group relative inline-flex items-center gap-1 cursor-help mb-1">
                    <FormLabel
                      className="mb-0 cursor-help"
                      title="Auto-resized to 400×400 px. JPEG, PNG or WebP, max 5MB."
                    >
                      Image
                    </FormLabel>
                    <span
                      className="text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                      title="Auto-resized to 400×400 px. JPEG, PNG or WebP, max 5MB."
                    >
                      <Info className="h-3.5 w-3.5" />
                    </span>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-64 rounded-lg border border-slate-200 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 shadow-lg group-hover:block dark:border-slate-600 dark:bg-slate-900"
                    >
                      Auto-resized to 400×400 px. JPEG, PNG or WebP, max 5MB.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 min-h-[38px]">
                    <label
                      htmlFor="item-image-upload"
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-200 hover:border-slate-400 focus-within:ring-2 focus-within:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      <Upload className="h-4 w-4" />
                      {imageUploading ? "Uploading…" : "Upload image"}
                      <input
                        id="item-image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={imageUploading || !selectedOrgId}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !selectedOrgId) return;
                          setImageUploading(true);
                          try {
                            const resized = await resizeImageTo400x400(file);
                            const { url } = await uploadItemImage(
                              token,
                              selectedOrgId,
                              resized
                            );
                            setFormImageUrl(url);
                            toast.success("Image uploaded.", { title: "Uploaded" });
                          } catch (err: unknown) {
                            const data = err && typeof err === "object" && "data" in err
                              ? (err as { data?: { message?: string } }).data
                              : undefined;
                            toast.error(
                              (data?.message as string) ?? "Image upload failed"
                            );
                          } finally {
                            setImageUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                    {formImageUrl && (
                      <div className="flex items-center gap-2">
                        <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
                          <img
                            src={getItemImageUrl(formImageUrl) ?? formImageUrl}
                            alt="Item"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormImageUrl("")}
                          className="rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-red-50 hover:border-red-300 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 min-h-[38px] pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formTrackInventory}
                      onChange={(e) => setFormTrackInventory(e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    Track inventory
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formVisibleInPos}
                      onChange={(e) => setFormVisibleInPos(e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    Visible in POS
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    Active
                  </label>
                </div>
              </div>

              {editingItem && (
                <>
                  <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-white">
                      Modifier groups
                    </h3>
                    {itemModifierGroups.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No modifier groups linked.
                      </p>
                    ) : (
                      <ul className="mb-2 space-y-1">
                        {itemModifierGroups.map(
                          (l: ItemModifierGroupLink) => (
                            <li
                              key={l.id}
                              className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-sm dark:bg-slate-700/50"
                            >
                              {modifierGroupName(l.modifierGroupId)}
                              <IconButton
                                variant="danger"
                                onClick={() =>
                                  deleteModifierGroupMutation.mutate(l.id)
                                }
                                title={`Unlink ${modifierGroupName(l.modifierGroupId)}`}
                                aria-label={`Unlink ${modifierGroupName(l.modifierGroupId)}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                    {availableModifierGroups.length > 0 && (
                      <form
                        onSubmit={handleAddModifierGroup}
                        className="flex gap-2"
                      >
                        <SearchableSelect
                          id="item-add-modifier-group"
                          options={modifierGroupAddOptions}
                          value={newModifierGroupId}
                          onChange={setNewModifierGroupId}
                          placeholder="Search modifier group…"
                          compact
                          className="min-w-0 flex-1"
                          controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                        />
                        <button
                          type="submit"
                          disabled={!newModifierGroupId}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-500 dark:hover:bg-primary-600"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add</span>
                        </button>
                      </form>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <Button type="submit" size="md" className="w-full" disabled={submitLoading || !isItemFormValid}>
                  {submitLoading ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="secondary" size="md" className="w-full" onClick={closeSlide}>
                  Cancel
                </Button>
              </div>
            </form>
          </SlideOver>

          <input
            ref={inlineFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              const item = inlineUploadItemRef.current;
              if (file && item) {
                handleInlineImageUpload(file, item);
              }
              e.target.value = "";
            }}
          />

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete item?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.name}</strong> will be hidden from the
                  catalog and removed from the POS menu.
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

function validatePriceCellValue(
  item: Item,
  field: "buyingPrice" | "defaultSellingPrice",
  rawValue: string
): string | null {
  const raw = rawValue.trim();
  if (raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return "Enter a non-negative number.";
  }
  const nextBuying = field === "buyingPrice" ? parsed : item.buyingPrice;
  const nextSelling =
    field === "defaultSellingPrice" ? parsed : item.defaultSellingPrice;
  if (
    nextBuying != null &&
    nextSelling != null &&
    nextSelling <= nextBuying
  ) {
    return "Selling must be greater than buying.";
  }
  return null;
}

interface PriceCellProps {
  item: Item;
  field: "buyingPrice" | "defaultSellingPrice";
  editing: {
    itemId: string;
    field: "buyingPrice" | "defaultSellingPrice";
    value: string;
  } | null;
  saving: boolean;
  onStartEdit: (value: string) => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function PriceCell({
  item,
  field,
  editing,
  saving,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
}: PriceCellProps) {
  const isEditing =
    editing?.itemId === item.id && editing.field === field;
  const currentValue = item[field];

  if (isEditing) {
    const error = validatePriceCellValue(item, field, editing.value);
    return (
      <div className="flex flex-col gap-0.5">
        <input
          type="number"
          step="0.01"
          min="0"
          autoFocus
          disabled={saving}
          value={editing.value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (error) return;
            onCommit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (error) return;
              onCommit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          aria-invalid={error ? true : undefined}
          className={`w-24 rounded border bg-white px-1.5 py-1 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-1 sm:text-sm dark:bg-slate-700 dark:text-white ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : "border-primary-500 focus:border-primary-500 focus:ring-primary-500"
          }`}
        />
        {error && (
          <span className="text-[11px] text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        onStartEdit(currentValue != null ? String(currentValue) : "")
      }
      className="rounded px-1.5 py-0.5 text-left font-semibold tabular-nums text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30"
      title="Click to edit"
    >
      {currentValue != null ? formatAmount(currentValue) : "—"}
    </button>
  );
}
