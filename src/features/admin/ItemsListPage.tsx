import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchCategories } from "@/api/categories";
import { fetchUoms } from "@/api/uoms";
import { fetchTaxProfiles } from "@/api/taxProfiles";
import { fetchModifierGroups } from "@/api/modifierGroups";
import {
  fetchItems,
  fetchItem,
  fetchItemIdsWithPrices,
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
import { SlideOver, Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { formatCurrency } from "@/utils/formatCurrency";
import { getItemImageUrl, getItemImageName } from "@/utils/itemImage";
import { resizeImageTo400x400 } from "@/utils/imageResize";
import { Plus, Pencil, Trash2, Upload, Banknote, ChevronDown } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { BARCODE_ITEMS, isBarcodeVisible } from "@/config/barcodeVisibility";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const ITEM_TYPES = ["STOCK", "SERVICE", "MENU", "BUNDLE"] as const;

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
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formItemType, setFormItemType] = useState<string>("MENU");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formBaseUomId, setFormBaseUomId] = useState("");
  const [formTaxProfileId, setFormTaxProfileId] = useState("");
  const [formTrackInventory, setFormTrackInventory] = useState(false);
  const [formActive, setFormActive] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [formBarcode, setFormBarcode] = useState("");
  const [newModifierGroupId, setNewModifierGroupId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [inlineUploadingItemId, setInlineUploadingItemId] = useState<string | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);
  const inlineUploadItemRef = useRef<Item | null>(null);

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
        baseUomId: item.baseUomId,
        taxProfileId: item.taxProfileId,
        trackInventory: item.trackInventory,
        active: item.active,
        buyingPrice: item.buyingPrice,
        defaultSellingPrice: item.defaultSellingPrice,
        defaultPriceListId: null,
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

  const { data: itemsData, isLoading, isError, error } = useQuery({
    queryKey: [
      "admin-items",
      token,
      selectedOrgId,
      selectedCategoryId || null,
      page,
      size,
    ],
    queryFn: () =>
      fetchItems(token, selectedOrgId, {
        page,
        size,
        categoryId: selectedCategoryId || undefined,
      }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: itemIdsWithPricesData } = useQuery({
    queryKey: ["admin-item-ids-with-prices", token, selectedOrgId],
    queryFn: () => fetchItemIdsWithPrices(token, selectedOrgId),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const itemIdsWithPrices = new Set(itemIdsWithPricesData?.itemIds ?? []);

  const { data: categoriesData } = useQuery({
    queryKey: ["admin-categories", token, selectedOrgId],
    queryFn: () => fetchCategories(token, selectedOrgId, { size: 500 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
    refetchOnMount: "always",
  });

  const { data: uomsData } = useQuery({
    queryKey: ["admin-uoms", token, selectedOrgId],
    queryFn: () => fetchUoms(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const { data: taxProfilesData } = useQuery({
    queryKey: ["admin-tax-profiles", token, selectedOrgId],
    queryFn: () => fetchTaxProfiles(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
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
      baseUomId: string | null;
      taxProfileId: string | null;
      trackInventory: boolean;
      active: boolean;
      buyingPrice: number | null;
      defaultSellingPrice: number | null;
      defaultPriceListId: string | null;
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
      baseUomId: string | null;
      taxProfileId: string | null;
      trackInventory: boolean;
      active: boolean;
      buyingPrice: number | null;
      defaultSellingPrice: number | null;
      defaultPriceListId: string | null;
      imageUrl: string | null;
    }) =>
      updateItem(token, selectedOrgId, body.itemId, {
        sku: body.sku,
        name: body.name,
        itemType: body.itemType,
        categoryId: body.categoryId,
        baseUomId: body.baseUomId,
        taxProfileId: body.taxProfileId,
        trackInventory: body.trackInventory,
        active: body.active,
        buyingPrice: body.buyingPrice,
        defaultSellingPrice: body.defaultSellingPrice,
        defaultPriceListId: body.defaultPriceListId,
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
  const items = itemsData?.content ?? [];
  const totalElements = itemsData?.totalElements ?? 0;
  const { searchQuery, setSearchQuery, filteredRows: filteredItems } = useTableSearch(items);
  const categories = categoriesData?.content ?? [];
  const uoms = uomsData?.content ?? [];
  const taxProfiles = taxProfilesData?.content ?? [];
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

  const itemUomOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...uoms.map((u: { id: string; name: string; symbol: string }) => ({
        value: u.id,
        label: `${u.name} (${u.symbol})`,
      })),
    ],
    [uoms]
  );

  const itemTaxProfileOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...taxProfiles.map((t: { id: string; name: string }) => ({
        value: t.id,
        label: t.name,
      })),
    ],
    [taxProfiles]
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
      setFormBaseUomId(editingItemData.baseUomId ?? "");
      setFormTaxProfileId(editingItemData.taxProfileId ?? "");
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
    setFormBaseUomId("");
    setFormTaxProfileId("");
    setFormTrackInventory(false);
    setFormActive(true);
    setFormImageUrl("");
    setFormBarcode("");
    setFormError(null);
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
  };

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError("Name is required.");
      return;
    }
    const itemBuyingPrice = editingItem?.buyingPrice ?? null;
    const payload = {
      sku: formSku.trim() || null,
      name: trimmed,
      itemType: formItemType,
      categoryId: formCategoryId || null,
      baseUomId: formBaseUomId || null,
      taxProfileId: formTaxProfileId || null,
      trackInventory: formTrackInventory,
      active: formActive,
      buyingPrice: editingItem ? (itemBuyingPrice ?? null) : null,
      defaultSellingPrice: editingItem?.defaultSellingPrice ?? null,
      defaultPriceListId: null,
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

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Items"
          subtitle="Loading…"
          fallbackTo="/admin"
        />
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
        <PageHeader
          title="Items"
          fallbackTo="/admin"
        />
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
      <PageHeader
        title="Items"
        subtitle="Catalog items: products, menu items, and services. Add barcodes and modifier groups when editing."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
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
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage items.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search items…" className="mb-4" />

          {totalElements > 0 && (
            <Pagination
              position="top"
              page={page}
              size={size}
              totalElements={totalElements}
              onPageChange={setPage}
            />
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "1000px" }}>
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:bg-slate-700/80 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      SKU
                    </th>
                    {showBarcode && (
                      <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                        Barcode
                      </th>
                    )}
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Type
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Active
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Buying
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Selling
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Prices
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Image
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showBarcode ? 10 : 9}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {items.length === 0 ? "No items yet. Add one to build your catalog." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item: Item) => (
                        <tr
                          key={item.id}
                          className={
                            item.hasPurchaseHistory === false
                              ? "bg-amber-50/60 hover:bg-amber-100/80 dark:bg-amber-900/15 dark:hover:bg-amber-900/30"
                              : "hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          }
                          title={
                            item.hasPurchaseHistory === false
                              ? "No purchase history—receive stock first before adding to price lists."
                              : undefined
                          }
                        >
                          <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 sm:px-3 sm:py-2 sm:text-sm dark:bg-slate-800 dark:text-white">
                            {item.name}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                            {item.sku ?? "—"}
                          </td>
                          {showBarcode && (
                            <td className="px-2 py-1.5 font-mono text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                              {item.barcode ?? "—"}
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {item.itemType}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm">
                            {item.active ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Yes
                              </span>
                            ) : (
                              <span className="text-slate-500">No</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs tabular-nums text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                            {item.buyingPrice != null
                              ? formatCurrency(item.buyingPrice)
                              : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-xs tabular-nums text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                            {item.defaultSellingPrice != null
                              ? formatCurrency(item.defaultSellingPrice)
                              : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm">
                            {itemIdsWithPrices.has(item.id) ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Yes
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm">
                            <button
                              type="button"
                              disabled={inlineUploadingItemId === item.id}
                              onClick={() => {
                                inlineUploadItemRef.current = item;
                                inlineFileInputRef.current?.click();
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                              title={item.primaryImageUrl ? "Change image" : "Upload image"}
                            >
                              {inlineUploadingItemId === item.id ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              {item.primaryImageUrl ? getItemImageName(item.primaryImageUrl) : "Upload"}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 text-left text-xs sm:px-3 sm:py-2 sm:text-sm">
                            <div className="flex justify-start gap-2">
                              <Link
                                to={
                                  selectedOrgId
                                    ? `/admin/price-lists?orgId=${selectedOrgId}&itemId=${item.id}`
                                    : "/admin/price-lists"
                                }
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                                title={
                                  itemIdsWithPrices.has(item.id)
                                    ? `Edit price for ${item.name}`
                                    : `Add price for ${item.name}`
                                }
                                aria-label={
                                  itemIdsWithPrices.has(item.id)
                                    ? `Edit price for ${item.name}`
                                    : `Add price for ${item.name}`
                                }
                              >
                                <Banknote className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                                title={`Edit ${item.name}`}
                                aria-label={`Edit ${item.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(item)}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                                title={`Delete ${item.name}`}
                                aria-label={`Delete ${item.name}`}
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
            title={editingItem ? "Edit item" : "Add item"}
            maxWidth="max-w-xl"
          >
            <form onSubmit={handleItemSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="item-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
                <input
                  id="item-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. Coca Cola 500ml"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="item-sku"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  SKU (optional)
                </label>
                <input
                  id="item-sku"
                  type="text"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              {showBarcode && (
                <div>
                  <label
                    htmlFor="item-barcode"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Barcode (optional)
                  </label>
                  <input
                    id="item-barcode"
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    placeholder="e.g. 5901234123457 or scan"
                    autoComplete="off"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="item-type"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Type
                </label>
                <SearchableSelect
                  id="item-type"
                  options={itemTypeOptions}
                  value={formItemType}
                  onChange={setFormItemType}
                  placeholder="Search type…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="item-category"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Category
                </label>
                <SearchableSelect
                  id="item-category"
                  options={itemCategoryOptions}
                  value={formCategoryId}
                  onChange={setFormCategoryId}
                  placeholder="Search category…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="item-uom"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Base UoM
                </label>
                <SearchableSelect
                  id="item-uom"
                  options={itemUomOptions}
                  value={formBaseUomId}
                  onChange={setFormBaseUomId}
                  placeholder="Search UoM…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="item-tax"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Tax profile
                </label>
                <SearchableSelect
                  id="item-tax"
                  options={itemTaxProfileOptions}
                  value={formTaxProfileId}
                  onChange={setFormTaxProfileId}
                  placeholder="Search tax profile…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
              <div className="flex gap-4">
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
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                  />
                  Active
                </label>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Item image (optional)
                </label>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Auto-resized to 400×400 px. JPEG, PNG or WebP, max 5MB.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="item-image-upload"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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
                        className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="Or paste image URL…"
                  aria-label="Image URL (optional)"
                />
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
                              <button
                                type="button"
                                onClick={() =>
                                  deleteModifierGroupMutation.mutate(l.id)
                                }
                                className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                title={`Unlink ${modifierGroupName(l.modifierGroupId)}`}
                                aria-label={`Unlink ${modifierGroupName(l.modifierGroupId)}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                          className="rounded-lg bg-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-500 dark:hover:bg-slate-600"
                        >
                          Add
                        </button>
                      </form>
                    )}
                  </div>
                </>
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
                    : editingItem
                      ? "Save"
                      : "Create"}
                </button>
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
                  <strong>{confirmDelete.name}</strong> will be deactivated. It
                  will no longer appear in the menu.
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
