import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackagePlus,
  Search,
  RotateCw,
  Plus,
  Pencil,
  Trash2,
  X,
  Building2,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Minus,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { useToast } from "@/context/ToastContext";
import {
  fetchGoodsReceiptNotes,
  createGoodsReceiptNote,
  updateGoodsReceiptNote,
  deleteGoodsReceiptNotePermanently,
  type GoodsReceiptNoteResponse,
  type GrnLineResponse,
} from "@/api/goodsReceiptNotes";
import { fetchSuppliers, type Supplier } from "@/api/suppliers";
import { fetchItems } from "@/api/catalog";
import { receivingRepository } from "@/repositories/receivingRepository";
import { catalogRepository } from "@/repositories/catalogRepository";
import type { Item } from "@/types";
import { formatCurrency, formatQty } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";

type GrnFlattenedRow = {
  grn: GoodsReceiptNoteResponse;
  line: GrnLineResponse;
};

export const ReceivingScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId, branchId, branchName } = useOrg();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");

  // Edit Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<GrnFlattenedRow | null>(null);
  const [editSupplierId, setEditSupplierId] = useState<string>("");
  const [editQty, setEditQty] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("");

  // Delete Confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<GrnFlattenedRow | null>(null);

  // Queries
  const {
    data: localGrns,
    isLoading: isGrnLoading,
    isRefetching: isGrnRefetching,
    refetch: refetchGrn,
  } = useQuery({
    queryKey: ["local-goods-receipt-notes", orgId, branchId],
    queryFn: () => receivingRepository.getReceiptNotes(orgId!, branchId!),
    enabled: Boolean(orgId && branchId),
  });

  // Background hydration
  useEffect(() => {
    if (!token || !orgId || !branchId) return;
    let active = true;

    fetchGoodsReceiptNotes(token, orgId, branchId, {
      page: 0,
      size: 200,
      includeInactive: false,
    })
      .then(async (res) => {
        if (!active || !res?.content) return;
        await receivingRepository.hydrateFromRemote(orgId, branchId, res.content);
        void queryClient.invalidateQueries({
          queryKey: ["local-goods-receipt-notes", orgId, branchId],
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [token, orgId, branchId, queryClient]);

  const { data: suppliersData } = useQuery({
    queryKey: ["mobile-suppliers", token, orgId],
    queryFn: () => fetchSuppliers(token, orgId!, { size: 200, includeInactive: false }),
    enabled: Boolean(token && orgId),
  });

  const { data: localItems } = useQuery({
    queryKey: ["local-items-all", orgId],
    queryFn: async () => {
      const items = await catalogRepository.getItems(orgId!);
      if (items.length > 0) return items;
      if (token) {
        const res = await fetchItems(token, orgId!, { page: 0, size: 400 });
        return res?.content ?? [];
      }
      return [];
    },
    enabled: Boolean(orgId),
  });

  const suppliers = useMemo(
    () => suppliersData?.content ?? [],
    [suppliersData?.content]
  );
  const allItems = useMemo(
    () => localItems ?? [],
    [localItems]
  );

  // Flatten receipts into line rows
  const flattenedRows: GrnFlattenedRow[] = useMemo(() => {
    const receipts = localGrns ?? [];
    const rows: GrnFlattenedRow[] = [];
    for (const grn of receipts) {
      if (!grn.lines || grn.lines.length === 0) continue;
      for (const line of grn.lines) {
        rows.push({ grn, line });
      }
    }
    // Sort descending by receivedAt
    return rows.sort((a, b) => b.grn.receivedAt.localeCompare(a.grn.receivedAt));
  }, [localGrns]);

  // Filtered rows by search
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return flattenedRows;
    return flattenedRows.filter((r) => {
      const matchItem = r.line.itemName?.toLowerCase().includes(q);
      const matchSupplier = r.grn.supplierName?.toLowerCase().includes(q);
      const matchBarcode = r.line.barcode?.toLowerCase().includes(q);
      return matchItem || matchSupplier || matchBarcode;
    });
  }, [flattenedRows, searchQuery]);

  // Metrics
  const summaryMetrics = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    for (const r of flattenedRows) {
      const q = r.line.qty ?? 0;
      const c = r.line.receivedUnitCost ?? 0;
      totalItems += q;
      totalCost += q * c;
    }
    const receiptsCount = (localGrns ?? []).length;
    return { receiptsCount, totalItems, totalCost };
  }, [flattenedRows, localGrns]);

  // Filter items in modal
  const filteredModalItems = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return allItems.slice(0, 20);
    return allItems
      .filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
      .slice(0, 25);
  }, [allItems, itemSearchQuery]);

  // Handle Refresh
  const handleRefresh = async () => {
    haptics.light();
    await refetchGrn();
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    haptics.light();
    setSelectedSupplierId(suppliers.length > 0 ? suppliers[0].id : "");
    setSelectedItem(null);
    setItemSearchQuery("");
    setQty("1");
    setUnitCost("");
    setCreateModalOpen(true);
  };

  // Select Item for Create
  const handleSelectItem = (item: Item) => {
    haptics.selection();
    setSelectedItem(item);
    setItemSearchQuery("");
    if (item.buyingPrice != null) {
      setUnitCost(String(item.buyingPrice));
    } else {
      setUnitCost("");
    }
  };

  // Create Mutation (Local-first persistence with background outbox synchronization)
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error("Please select an item");
      const numQty = Number(qty);
      if (isNaN(numQty) || numQty <= 0) throw new Error("Quantity must be greater than 0");
      const numCost = unitCost ? Number(unitCost) : 0;
      if (isNaN(numCost) || numCost < 0) {
        throw new Error("Unit buy price must be 0 or greater");
      }

      return receivingRepository.createReceiptNote(orgId!, branchId!, {
        supplierId: selectedSupplierId || null,
        itemId: selectedItem.id,
        quantity: numQty,
        unitCost: numCost,
      });
    },
    onSuccess: () => {
      haptics.success();
      toast.success("Stock received and persisted locally.");
      setCreateModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["local-goods-receipt-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["local-items-all"] });
      void queryClient.invalidateQueries({ queryKey: ["local-stock-count-sheet"] });
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err.message ?? "Failed to receive stock");
    },
  });

  // Open Edit Modal
  const handleOpenEdit = (row: GrnFlattenedRow) => {
    haptics.light();
    setEditingRow(row);
    setEditSupplierId(row.grn.supplierId);
    setEditQty(String(row.line.qty));
    setEditUnitCost(row.line.receivedUnitCost != null ? String(row.line.receivedUnitCost) : "");
    setEditModalOpen(true);
  };

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingRow) return;
      const numQty = Number(editQty);
      if (isNaN(numQty) || numQty <= 0) throw new Error("Quantity must be greater than 0");
      const numCost = editUnitCost ? Number(editUnitCost) : null;
      if (numCost != null && (isNaN(numCost) || numCost < 0)) {
        throw new Error("Unit price must be positive");
      }

      return updateGoodsReceiptNote(token, orgId!, editingRow.grn.id, {
        supplierId: editSupplierId,
        receivedAt: editingRow.grn.receivedAt,
        lines: [
          {
            itemId: editingRow.line.itemId,
            qty: numQty,
            receivedUnitCost: numCost,
          },
        ],
      });
    },
    onSuccess: () => {
      haptics.success();
      toast.success("Stock receipt updated successfully.");
      setEditModalOpen(false);
      setEditingRow(null);
      queryClient.invalidateQueries({ queryKey: ["mobile-goods-receipt-notes"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-items-all"] });
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err.message ?? "Failed to update stock receipt");
    },
  });

  // Open Delete Confirm
  const handlePromptDelete = (row: GrnFlattenedRow) => {
    haptics.warning();
    setRowToDelete(row);
    setDeleteConfirmOpen(true);
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!rowToDelete) return;
      return deleteGoodsReceiptNotePermanently(token, orgId!, rowToDelete.grn.id);
    },
    onSuccess: () => {
      haptics.success();
      toast.success("Stock receipt deleted. Inventory movements reversed.");
      setDeleteConfirmOpen(false);
      setRowToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["mobile-goods-receipt-notes"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-items-all"] });
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err.message ?? "Failed to delete receipt");
    },
  });

  const parsedCreateTotal = (Number(qty) || 0) * (Number(unitCost) || 0);
  const parsedEditTotal = (Number(editQty) || 0) * (Number(editUnitCost) || 0);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isGrnRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header Title & Refresh */}
        <View style={styles.header}>
          <View style={styles.titleHeaderRow}>
            <View style={styles.titleRow}>
              <PackagePlus size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Stock Receiving</Text>
            </View>
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isGrnRefetching}
              activeOpacity={0.7}
              style={[
                styles.headerRefreshBtn,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              {isGrnRefetching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RotateCw size={16} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {branchName ? `${branchName} • ` : ""}Receive stock into inventory and view records
          </Text>
        </View>

        {/* Search Bar & Action Button (Same Horizontal Level) */}
        <View style={styles.searchAndActionRow}>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <Search size={15} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search item, supplier, barcode..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={handleOpenCreate}
            activeOpacity={0.8}
            style={[styles.receiveBtnBeside, { backgroundColor: colors.primary }]}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.receiveBtnBesideText}>Receive</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Metric Cards */}
        <View style={styles.metricsRow}>
          <StatCard
            label="Total Receipts"
            value={summaryMetrics.receiptsCount}
            variant="neutral"
            style={styles.metricCard}
          />
          <StatCard
            label="Items Received"
            value={formatQty(summaryMetrics.totalItems)}
            variant="neutral"
            style={styles.metricCard}
          />
          <StatCard
            label="Total Value"
            value={formatCurrency(summaryMetrics.totalCost)}
            variant="primary"
            style={styles.metricCard}
          />
        </View>

        {/* Loading Skeletons */}
        {isGrnLoading && !localGrns ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} style={{ padding: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <SkeletonBlock width="55%" height={16} radius={6} />
                  <SkeletonBlock width={70} height={16} radius={6} />
                </View>
                <SkeletonBlock width="40%" height={12} radius={4} />
                <SkeletonBlock width="70%" height={12} radius={4} />
              </Card>
            ))}
          </View>
        ) : filteredRows.length === 0 ? (
          <Card style={styles.emptyCard}>
            <PackagePlus size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {searchQuery ? "No matching stock receipts" : "No stock received yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {searchQuery
                ? "Try searching with a different item name or supplier."
                : "Tap '+ Receive Stock' above to record your first inventory delivery."}
            </Text>
          </Card>
        ) : (
          /* List of Receipts (Mobile Cards) */
          <View style={{ gap: 10, marginTop: 6 }}>
            {filteredRows.map((row) => {
              const lineCost = (row.line.qty ?? 0) * (row.line.receivedUnitCost ?? 0);
              const formattedDate = row.grn.receivedAt
                ? new Date(row.grn.receivedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—";

              return (
                <Card key={`${row.grn.id}-${row.line.id}`} style={styles.receiptCard}>
                  {/* Line 1: Item Name (Left) & Total + Action Icons (Right) */}
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                      {row.line.itemName}
                    </Text>

                    <View style={styles.headerRightGroup}>
                      <Text style={[styles.itemTotalCost, { color: colors.primary }]}>
                        {formatCurrency(lineCost)}
                      </Text>

                      <View style={styles.iconActionsGroup}>
                        <TouchableOpacity
                          onPress={() => handleOpenEdit(row)}
                          activeOpacity={0.7}
                          style={[
                            styles.iconActionBtn,
                            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                          ]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Pencil size={12} color={colors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handlePromptDelete(row)}
                          activeOpacity={0.7}
                          style={[
                            styles.iconActionBtn,
                            { backgroundColor: colors.dangerLight, borderColor: colors.danger },
                          ]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Trash2 size={12} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Line 2: Quantity & Unit Cost (Left) & Supplier + Date (Right) */}
                  <View style={styles.cardDetailRow}>
                    <Text style={[styles.cardSubDetail, { color: colors.textMuted }]} numberOfLines={1}>
                      Qty: <Text style={{ fontWeight: "700", color: colors.text }}>{formatQty(row.line.qty)}</Text> units
                      {" · "}
                      @ {row.line.receivedUnitCost != null ? formatCurrency(row.line.receivedUnitCost) : "0.00"}
                    </Text>

                    <View style={styles.cardMetaGroup}>
                      <Building2 size={11} color={colors.textMuted} />
                      <Text
                        style={[styles.supplierText, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {row.grn.supplierName || "Direct"}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>•</Text>
                      <Calendar size={11} color={colors.textMuted} />
                      <Text style={[styles.dateText, { color: colors.textMuted }]}>
                        {formattedDate}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* Receive Stock Modal (+ Receive Stock) */}
      {/* ========================================================================= */}
      <Modal
        visible={createModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalOverlay}
          onPressBackdrop={() => setCreateModalOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceCard }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Receive Stock</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  Add inventory from supplier into {branchName || "branch"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCreateModalOpen(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceRaised }]}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Supplier Selector */}
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  SUPPLIER *
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginTop: 6 }}
                >
                  {suppliers.map((s) => {
                    const isSelected = selectedSupplierId === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => {
                          haptics.selection();
                          setSelectedSupplierId(s.id);
                        }}
                        style={[
                          styles.chipOption,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surfaceRaised,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipOptionText,
                            { color: isSelected ? "#fff" : colors.text },
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Item Selector */}
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  CATALOG ITEM *
                </Text>
                {selectedItem ? (
                  <View
                    style={[
                      styles.selectedItemCard,
                      { backgroundColor: colors.surfaceRaised, borderColor: colors.primary },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedItemName, { color: colors.text }]}>
                        {selectedItem.name}
                      </Text>
                      <Text style={[styles.selectedItemMeta, { color: colors.textMuted }]}>
                        SKU: {selectedItem.sku || "N/A"} • Buy:{" "}
                        {selectedItem.buyingPrice != null
                          ? formatCurrency(selectedItem.buyingPrice)
                          : "—"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedItem(null)}
                      style={[styles.clearItemBtn, { backgroundColor: colors.surface }]}
                    >
                      <X size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginTop: 6 }}>
                    <View
                      style={[
                        styles.itemSearchInputRow,
                        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                      ]}
                    >
                      <Search size={14} color={colors.textMuted} />
                      <TextInput
                        style={[styles.itemSearchInput, { color: colors.text }]}
                        placeholder="Search item to receive..."
                        placeholderTextColor={colors.textMuted}
                        value={itemSearchQuery}
                        onChangeText={setItemSearchQuery}
                      />
                    </View>

                    {/* Quick selection items list */}
                    <ScrollView
                      style={{ maxHeight: 150, marginTop: 6 }}
                      nestedScrollEnabled={true}
                    >
                      {filteredModalItems.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => handleSelectItem(item)}
                          style={[
                            styles.itemPickerRow,
                            { borderBottomColor: colors.border },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemPickerName, { color: colors.text }]}>
                              {item.name}
                            </Text>
                            <Text style={[styles.itemPickerMeta, { color: colors.textMuted }]}>
                              {item.categoryName ? `${item.categoryName} • ` : ""}Buy:{" "}
                              {item.buyingPrice != null
                                ? formatCurrency(item.buyingPrice)
                                : "KES 0.00"}
                            </Text>
                          </View>
                          <ChevronRight size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Quantity Stepper Input */}
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  QUANTITY RECEIVED *
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      const current = Number(qty) || 1;
                      if (current > 1) setQty(String(current - 1));
                    }}
                    style={[styles.stepperBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                  >
                    <Minus size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.stepperInput,
                      {
                        backgroundColor: colors.surfaceRaised,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="numeric"
                    value={qty}
                    onChangeText={setQty}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      const current = Number(qty) || 0;
                      setQty(String(current + 1));
                    }}
                    style={[styles.stepperBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                  >
                    <Plus size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Unit Buy Price */}
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  UNIT BUY PRICE (KES)
                </Text>
                <TextInput
                  style={[
                    styles.formTextInput,
                    {
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={unitCost}
                  onChangeText={setUnitCost}
                />
              </View>
            </ScrollView>

            {/* Pinned Action Footer */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.surfaceCard }]}>
              {/* Live Calculation Preview Banner */}
              <View
                style={[
                  styles.calcBanner,
                  { backgroundColor: colors.surfaceRaised, borderColor: colors.primary, marginBottom: 12 },
                ]}
              >
                <Text style={[styles.calcBannerLabel, { color: colors.textMuted }]}>
                  Calculated Total
                </Text>
                <Text style={[styles.calcBannerAmount, { color: colors.primary }]}>
                  {formatCurrency(parsedCreateTotal)}
                </Text>
              </View>

              <View style={styles.modalBtns}>
                <Button
                  variant="secondary"
                  title="Cancel"
                  onPress={() => setCreateModalOpen(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  onPress={() => createMutation.mutate()}
                  loading={createMutation.isPending}
                  disabled={!selectedItem || !selectedSupplierId || createMutation.isPending}
                  title="Confirm & Receive Stock"
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* ========================================================================= */}
      {/* Edit Receipt Modal */}
      {/* ========================================================================= */}
      <Modal
        visible={editModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalOpen(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalOverlay}
          onPressBackdrop={() => setEditModalOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceCard }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Stock Receipt</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {editingRow?.line.itemName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditModalOpen(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceRaised }]}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 340 }}
              contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Supplier Selector */}
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  SUPPLIER
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginTop: 6 }}
                >
                  {suppliers.map((s) => {
                    const isSelected = editSupplierId === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => {
                          haptics.selection();
                          setEditSupplierId(s.id);
                        }}
                        style={[
                          styles.chipOption,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surfaceRaised,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipOptionText,
                            { color: isSelected ? "#fff" : colors.text },
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Edit Quantity */}
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  QUANTITY
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      const current = Number(editQty) || 1;
                      if (current > 1) setEditQty(String(current - 1));
                    }}
                    style={[styles.stepperBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                  >
                    <Minus size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.stepperInput,
                      {
                        backgroundColor: colors.surfaceRaised,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="numeric"
                    value={editQty}
                    onChangeText={setEditQty}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      const current = Number(editQty) || 0;
                      setEditQty(String(current + 1));
                    }}
                    style={[styles.stepperBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                  >
                    <Plus size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Edit Unit Buy Price */}
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  UNIT BUY PRICE (KES)
                </Text>
                <TextInput
                  style={[
                    styles.formTextInput,
                    {
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="numeric"
                  value={editUnitCost}
                  onChangeText={setEditUnitCost}
                />
              </View>
            </ScrollView>

            {/* Pinned Action Footer */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.surfaceCard }]}>
              {/* Live Preview */}
              <View
                style={[
                  styles.calcBanner,
                  { backgroundColor: colors.surfaceRaised, borderColor: colors.primary, marginBottom: 12 },
                ]}
              >
                <Text style={[styles.calcBannerLabel, { color: colors.textMuted }]}>
                  Updated Total
                </Text>
                <Text style={[styles.calcBannerAmount, { color: colors.primary }]}>
                  {formatCurrency(parsedEditTotal)}
                </Text>
              </View>

              <View style={styles.modalBtns}>
                <Button
                  variant="secondary"
                  title="Cancel"
                  onPress={() => setEditModalOpen(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  onPress={() => editMutation.mutate()}
                  loading={editMutation.isPending}
                  disabled={editMutation.isPending}
                  title="Save Changes"
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </View>
        </AnimatedModalBackdrop>
      </Modal>

      {/* ========================================================================= */}
      {/* Delete Confirmation Modal */}
      {/* ========================================================================= */}
      <Modal
        visible={deleteConfirmOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteConfirmOpen(false)}
      >
        <TouchableOpacity
          style={styles.dialogOverlay}
          activeOpacity={1}
          onPress={() => setDeleteConfirmOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380 }}
          >
            <Card style={[styles.dialogCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <View style={styles.dialogIconRow}>
                <View style={[styles.dialogDangerIcon, { backgroundColor: colors.dangerLight }]}>
                  <AlertTriangle size={22} color={colors.danger} />
                </View>
              </View>
              <Text style={[styles.dialogTitle, { color: colors.text }]}>
                Delete Stock Receipt?
              </Text>
              <Text style={[styles.dialogMessage, { color: colors.textMuted }]}>
                Are you sure you want to delete this receipt for{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  {rowToDelete?.line.itemName}
                </Text>
                ? This action will reverse inventory stock movements.
              </Text>
              <View style={styles.dialogButtonsRow}>
                <Button
                  variant="outline"
                  onPress={() => setDeleteConfirmOpen(false)}
                  title="Cancel"
                  style={{ flex: 1 }}
                />
                <Button
                  variant="danger"
                  onPress={() => deleteMutation.mutate()}
                  loading={deleteMutation.isPending}
                  title="Delete"
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 14,
  },
  titleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  searchAndActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  receiveBtnBeside: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
  },
  receiveBtnBesideText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
  },
  receiptCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  itemTotalCost: {
    fontSize: 14,
    fontWeight: "800",
  },
  iconActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardSubDetail: {
    fontSize: 12,
    flexShrink: 0,
    marginRight: 8,
  },
  cardMetaGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    justifyContent: "flex-end",
  },
  supplierText: {
    fontSize: 11,
    flexShrink: 1,
  },
  dateText: {
    fontSize: 11,
    flexShrink: 0,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  selectedItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 6,
  },
  selectedItemName: {
    fontSize: 14,
    fontWeight: "700",
  },
  selectedItemMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  clearItemBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemSearchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  itemSearchInput: {
    flex: 1,
    fontSize: 13,
  },
  itemPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemPickerName: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemPickerMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperInput: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },
  formTextInput: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 6,
  },
  calcBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  calcBannerLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  calcBannerAmount: {
    fontSize: 17,
    fontWeight: "800",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 380,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  dialogIconRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  dialogDangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  dialogMessage: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  dialogButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalBtns: {
    flexDirection: "row",
    alignItems: "center",
  },
});
