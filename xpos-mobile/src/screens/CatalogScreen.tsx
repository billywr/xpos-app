import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { useToast } from "@/context/ToastContext";
import {
  Search,
  Package,
  Plus,
  X,
  Layers,
  CheckCircle2,
  RefreshCw,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import {
  fetchItems,
  fetchCategories,
} from "@/api/catalog";
import { catalogRepository } from "@/repositories/catalogRepository";
import { outboxEngine } from "@/services/outboxEngine";
import { useSyncStatus } from "@/services/useSyncStatus";
import type { Item, Category } from "@/types";
import { formatCurrency } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";
import { ScalePressable } from "@/components/ui/ScalePressable";
import { SyncStatusDot } from "@/components/SyncStatusDot";
import { useRouter } from "expo-router";

const PAGE_SIZE = 30;

// ---------------------------------------------------------------------------
// Skeleton card matching the real catalog item card layout
// ---------------------------------------------------------------------------
const CatalogSkeletonCard: React.FC = () => (
  <Card style={{ padding: 14, marginBottom: 10 }}>
    {/* top row: name block + price */}
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
      <View style={{ flex: 1, gap: 6, marginRight: 12 }}>
        <SkeletonBlock width="70%" height={15} radius={6} />
        <SkeletonBlock width={60} height={11} radius={5} />
      </View>
      <SkeletonBlock width={64} height={18} radius={6} />
    </View>
    {/* badge row */}
    <View style={{ flexDirection: "row", gap: 6 }}>
      <SkeletonBlock width={72} height={20} radius={10} />
      <SkeletonBlock width={60} height={20} radius={10} />
      <SkeletonBlock width={48} height={20} radius={10} />
    </View>
  </Card>
);

export const CatalogScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId } = useOrg();
  const { isOnline } = useSyncStatus();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Item Create/Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formItemType, setFormItemType] = useState("MENU");
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formBuyingPrice, setFormBuyingPrice] = useState("");
  const [formTrackInventory, setFormTrackInventory] = useState(true);
  const [formActive, setFormActive] = useState(true);
  const [formVisibleInPos, setFormVisibleInPos] = useState(true);

  // Instant local SQLite categories query (<2ms)
  const { data: localCategories, refetch: refetchCategories } = useQuery({
    queryKey: ["local-catalog-categories", orgId],
    queryFn: () => catalogRepository.getCategories(orgId!),
    enabled: Boolean(orgId),
  });
  const categories = localCategories ?? [];

  // Instant local SQLite items query (<5ms)
  const {
    data: localItems,
    isLoading: itemsLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["local-catalog-items", orgId],
    queryFn: () => catalogRepository.getItems(orgId!),
    enabled: Boolean(orgId),
  });

  const allItems = localItems ?? [];
  const items = useMemo(() => {
    if (!selectedCategoryId) return allItems;
    return allItems.filter((i) => i.categoryId === selectedCategoryId);
  }, [allItems, selectedCategoryId]);

  const hasNextPage = false;
  const isFetchingNextPage = false;
  const fetchNextPage = async () => {};

  // Background hydration: updates SQLite in the background and invalidates cache
  React.useEffect(() => {
    if (!token || !orgId || !isOnline) return;
    void catalogRepository.hydrateCatalog(token, orgId).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["local-catalog-categories", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["local-catalog-items", orgId] });
    });
  }, [token, orgId, isOnline, queryClient]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Progressive chunk-by-chunk windowing for high-performance 60fps rendering
  const { visibleItems: progressiveItems, loadMore: loadMoreItems } = useProgressiveList(
    filteredItems,
    { chunkSize: 24 }
  );

  // Open Create Item Modal
  const handleOpenCreate = () => {
    haptics.light();
    setEditingItem(null);
    setFormName("");
    setFormSku("");
    setFormItemType("MENU");
    setFormCategoryId(selectedCategoryId ?? null);
    setFormSellingPrice("");
    setFormBuyingPrice("");
    setFormTrackInventory(true);
    setFormActive(true);
    setFormVisibleInPos(true);
    setModalOpen(true);
  };

  // Open Edit Item Modal (View & Edit)
  const handleOpenEdit = (item: Item) => {
    haptics.medium();
    setEditingItem(item);
    setFormName(item.name);
    setFormSku(item.sku || "");
    setFormItemType(item.itemType || "MENU");
    setFormCategoryId(item.categoryId || null);
    setFormSellingPrice(
      item.defaultSellingPrice != null ? String(item.defaultSellingPrice) : ""
    );
    setFormBuyingPrice(
      item.buyingPrice != null ? String(item.buyingPrice) : ""
    );
    setFormTrackInventory(item.trackInventory ?? true);
    setFormActive(item.active ?? true);
    setFormVisibleInPos(item.visibleInPos ?? true);
    setModalOpen(true);
  };

  // Create Mutation - writes locally to SQLite in <5ms and enqueues outbox sync
  const createMutation = useMutation({
    mutationFn: () =>
      catalogRepository.saveItem(orgId!, {
        name: formName.trim(),
        sku: formSku.trim() || null,
        itemType: formItemType,
        categoryId: formCategoryId || null,
        defaultSellingPrice: formSellingPrice ? Number(formSellingPrice) : null,
        buyingPrice: formBuyingPrice ? Number(formBuyingPrice) : null,
        trackInventory: formTrackInventory,
        active: formActive,
        visibleInPos: formVisibleInPos,
      }),
    onSuccess: () => {
      haptics.success();
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
      void outboxEngine.processQueue();
      toast.success("Item saved locally and syncing to remote.");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to save item.", "Error");
    },
  });

  // Update Mutation - writes locally to SQLite in <5ms and enqueues outbox sync
  const updateMutation = useMutation({
    mutationFn: () =>
      catalogRepository.saveItem(
        orgId!,
        {
          name: formName.trim(),
          sku: formSku.trim() || null,
          itemType: formItemType,
          categoryId: formCategoryId || null,
          defaultSellingPrice: formSellingPrice ? Number(formSellingPrice) : null,
          buyingPrice: formBuyingPrice ? Number(formBuyingPrice) : null,
          trackInventory: formTrackInventory,
          active: formActive,
          visibleInPos: formVisibleInPos,
        },
        editingItem!.id
      ),
    onSuccess: () => {
      haptics.success();
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
      void outboxEngine.processQueue();
      toast.success("Item updated locally and syncing to remote.");
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.data?.message ?? err?.message ?? "Failed to update item.", "Error");
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleToolbarRefresh = async () => {
    haptics.light();
    if (token && orgId) {
      void catalogRepository.hydrateCatalog(token, orgId);
    }
    await Promise.all([refetch(), refetchCategories()]);
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Search Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search items, SKU…"
            leftIcon={<Search size={16} color={colors.textSubtle} />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <SyncStatusDot />
        <Button
          title="+ Add Item"
          size="sm"
          onPress={handleOpenCreate}
          style={styles.addBtn}
        />
        <TouchableOpacity
          onPress={handleToolbarRefresh}
          disabled={isRefetching}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh catalog items"
          style={[
            styles.refreshToolbarBtn,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          {isRefetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={16} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Categories Horizontal Scroll */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPills}
        >
          <ScalePressable
            onPress={() => {
              haptics.light();
              setSelectedCategoryId(null);
            }}
            activeScale={0.94}
            style={[
              styles.pill,
              {
                backgroundColor:
                  selectedCategoryId === null
                    ? colors.primary
                    : colors.surfaceRaised,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                {
                  color: selectedCategoryId === null ? "#ffffff" : colors.textMuted,
                  fontWeight: selectedCategoryId === null ? "700" : "500",
                },
              ]}
            >
              All Items ({items.length})
            </Text>
          </ScalePressable>

          {categories.map((cat: Category) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <ScalePressable
                key={cat.id}
                onPress={() => {
                  haptics.light();
                  setSelectedCategoryId(isSelected ? null : cat.id);
                }}
                activeScale={0.94}
                style={[
                  styles.pill,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.surfaceRaised,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color: isSelected ? "#ffffff" : colors.textMuted,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {cat.name}
                </Text>
              </ScalePressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Item List */}
      {itemsLoading && (!localItems || allItems.length === 0) ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, { paddingTop: 10 }]}
          scrollEnabled={false}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <CatalogSkeletonCard key={i} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={progressiveItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          onEndReachedThreshold={0.5}
          onEndReached={loadMoreItems}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Package size={40} color={colors.textSubtle} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchQuery ? "No items match your search." : "No catalog items found."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                handleOpenEdit(item);
              }}
              onLongPress={() => {
                handleOpenEdit(item);
              }}
              activeOpacity={0.7}
            >
              <Card style={styles.itemCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemSku, { color: colors.textSubtle }]}>
                      SKU: {item.sku || "N/A"}
                    </Text>
                  </View>
                  <Text style={[styles.itemPrice, { color: colors.primary }]}>
                    {formatCurrency(item.defaultSellingPrice)}
                  </Text>
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.badgesRow}>
                    {item.categoryName ? (
                      <Badge label={item.categoryName} variant="neutral" size="sm" />
                    ) : null}
                    {item.trackInventory ? (
                      <Badge label="Tracked" variant="accent" size="sm" />
                    ) : (
                      <Badge label="Untracked" variant="neutral" size="sm" />
                    )}
                    {item.active ? (
                      <Badge label="Active" variant="primary" size="sm" />
                    ) : (
                      <Badge label="Inactive" variant="danger" size="sm" />
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Item Create / Edit Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setModalOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingItem ? "Edit item details" : "Add new item"}
                </Text>
                {editingItem ? (
                  <Text style={[styles.modalSubtitle, { color: colors.textSubtle }]}>
                    {editingItem.categoryName ? `${editingItem.categoryName} · ` : ""}SKU: {editingItem.sku || "N/A"}
                  </Text>
                ) : (
                  <Text style={[styles.modalSubtitle, { color: colors.textSubtle }]}>
                    Create a new product or service for your catalog
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <Input
                label="Item Name *"
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Tusker Cider 500ml"
              />

              <View style={styles.twoColRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Input
                    label="Selling Price *"
                    value={formSellingPrice}
                    onChangeText={setFormSellingPrice}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Buying Price"
                    value={formBuyingPrice}
                    onChangeText={setFormBuyingPrice}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                label="SKU / Barcode"
                value={formSku}
                onChangeText={setFormSku}
                placeholder="e.g. TSK-500"
              />

              {/* Category Selection */}
              <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
                Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryPickerRow}
              >
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setFormCategoryId(null);
                  }}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor:
                        formCategoryId === null ? colors.primary : colors.surfaceRaised,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color: formCategoryId === null ? "#ffffff" : colors.textMuted,
                        fontWeight: formCategoryId === null ? "700" : "500",
                      },
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>
                {categories.map((c) => {
                  const isSel = formCategoryId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        haptics.light();
                        setFormCategoryId(isSel ? null : c.id);
                      }}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: isSel
                            ? colors.primary
                            : colors.surfaceRaised,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          {
                            color: isSel ? "#ffffff" : colors.textMuted,
                            fontWeight: isSel ? "700" : "500",
                          },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Item Type Selection */}
              <Text style={[styles.fieldLabel, { color: colors.textSubtle, marginTop: 12 }]}>
                Item Type
              </Text>
              <View style={styles.itemTypeRow}>
                {["MENU", "RETAIL", "SERVICE"].map((t) => {
                  const isSel = formItemType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        haptics.light();
                        setFormItemType(t);
                      }}
                      style={[
                        styles.typePill,
                        {
                          backgroundColor: isSel
                            ? colors.primaryLight
                            : colors.surfaceRaised,
                          borderColor: isSel ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          {
                            color: isSel ? colors.primary : colors.textMuted,
                            fontWeight: isSel ? "700" : "500",
                          },
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Toggle Switches */}
              <View style={[styles.togglesBox, { borderColor: colors.borderSubtle }]}>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Track Inventory
                  </Text>
                  <Switch
                    value={formTrackInventory}
                    onValueChange={setFormTrackInventory}
                    trackColor={{ false: colors.surfaceRaised, true: colors.primary }}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Active
                  </Text>
                  <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: colors.surfaceRaised, true: colors.primary }}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Visible in POS
                  </Text>
                  <Switch
                    value={formVisibleInPos}
                    onValueChange={setFormVisibleInPos}
                    trackColor={{ false: colors.surfaceRaised, true: colors.primary }}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setModalOpen(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={editingItem ? "Update Item" : "Create Item"}
                loading={isSaving}
                disabled={!formName.trim() || isSaving}
                onPress={() => {
                  if (editingItem) {
                    updateMutation.mutate();
                  } else {
                    createMutation.mutate();
                  }
                }}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  searchBox: {
    flex: 1,
  },
  addBtn: {
    paddingHorizontal: 14,
    height: 42,
  },
  refreshToolbarBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  categoryScrollContainer: {
    paddingBottom: 8,
  },
  categoryPills: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  itemCard: {
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
  },
  itemSku: {
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  twoColRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryPickerRow: {
    gap: 8,
    paddingBottom: 6,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  catChipText: {
    fontSize: 12,
  },
  itemTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  typePillText: {
    fontSize: 12,
  },
  togglesBox: {
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    paddingVertical: 8,
    marginVertical: 8,
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalBtns: {
    flexDirection: "row",
    marginTop: 14,
    paddingBottom: 8,
  },
});
