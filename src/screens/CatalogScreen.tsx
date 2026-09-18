import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Barcode,
  Tag,
  Package,
  Plus,
  Layers,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import {
  fetchItems,
  fetchCategories,
  fetchItemBarcodes,
  addItemBarcode,
} from "@/api/catalog";
import type { Item, Category } from "@/types";
import { formatCurrency } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

export const CatalogScreen: React.FC = () => {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId } = useOrg();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Selected item for detail modal
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [newBarcode, setNewBarcode] = useState("");

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["catalog-categories", token, orgId],
    queryFn: () => fetchCategories(token, orgId!),
    enabled: Boolean(token && orgId),
  });
  const categories = categoriesData?.content ?? [];

  // Fetch items
  const {
    data: itemsData,
    isLoading: itemsLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["catalog-items", token, orgId, selectedCategoryId],
    queryFn: () =>
      fetchItems(token, orgId!, {
        size: 150,
        categoryId: selectedCategoryId,
      }),
    enabled: Boolean(token && orgId),
  });
  const items = itemsData?.content ?? [];

  // Fetch item barcodes for modal
  const { data: barcodesData, refetch: refetchBarcodes } = useQuery({
    queryKey: ["item-barcodes", token, orgId, selectedItem?.id],
    queryFn: () => fetchItemBarcodes(token, orgId!, selectedItem!.id),
    enabled: Boolean(token && orgId && selectedItem),
  });

  // Add barcode mutation
  const addBarcodeMutation = useMutation({
    mutationFn: (barcode: string) =>
      addItemBarcode(token, orgId!, selectedItem!.id, barcode),
    onSuccess: () => {
      haptics.success();
      setNewBarcode("");
      void refetchBarcodes();
      Alert.alert("Success", "Barcode added to item.");
    },
    onError: (err: any) => {
      haptics.error();
      Alert.alert("Error", err?.data?.message ?? "Failed to add barcode.");
    },
  });

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        <TouchableOpacity
          onPress={() => setScannerOpen(true)}
          style={[styles.scannerBtn, { backgroundColor: colors.surfaceRaised }]}
        >
          <Barcode size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Categories Horizontal Scroll */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPills}
        >
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setSelectedCategoryId(null);
            }}
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
          </TouchableOpacity>

          {categories.map((cat: Category) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  haptics.light();
                  setSelectedCategoryId(isSelected ? null : cat.id);
                }}
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Item List */}
      {itemsLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading catalog items…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
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
                setSelectedItem(item);
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

      {/* Item Detail & Barcodes Modal */}
      <Modal visible={Boolean(selectedItem)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedItem?.name}
                </Text>
                <Text style={[styles.modalSku, { color: colors.textSubtle }]}>
                  SKU: {selectedItem?.sku || "N/A"}
                </Text>
              </View>
              <Badge
                label={selectedItem?.active ? "Active" : "Inactive"}
                variant={selectedItem?.active ? "primary" : "danger"}
              />
            </View>

            {/* Price Info */}
            <View
              style={[
                styles.priceGrid,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <View style={styles.priceCol}>
                <Text style={[styles.priceLabel, { color: colors.textSubtle }]}>
                  Selling Price
                </Text>
                <Text style={[styles.priceVal, { color: colors.primary }]}>
                  {formatCurrency(selectedItem?.defaultSellingPrice)}
                </Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={[styles.priceLabel, { color: colors.textSubtle }]}>
                  Buying Price
                </Text>
                <Text style={[styles.priceVal, { color: colors.textMuted }]}>
                  {formatCurrency(selectedItem?.buyingPrice)}
                </Text>
              </View>
            </View>

            {/* Barcodes Section */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Barcodes
            </Text>
            <View style={styles.barcodesBox}>
              {(barcodesData ?? []).length === 0 ? (
                <Text style={[styles.emptyBarcode, { color: colors.textSubtle }]}>
                  No barcodes assigned.
                </Text>
              ) : (
                barcodesData?.map((b) => (
                  <View
                    key={b.id}
                    style={[
                      styles.barcodeChip,
                      { backgroundColor: colors.surfaceRaised },
                    ]}
                  >
                    <Barcode size={16} color={colors.primary} />
                    <Text style={[styles.barcodeText, { color: colors.text }]}>
                      {b.barcode}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Add barcode inline */}
            <View style={styles.addBarcodeRow}>
              <Input
                value={newBarcode}
                onChangeText={setNewBarcode}
                placeholder="Scan or enter new barcode…"
                keyboardType="numeric"
                containerStyle={{ flex: 1, marginBottom: 0 }}
              />
              <Button
                title="Add"
                disabled={!newBarcode.trim()}
                loading={addBarcodeMutation.isPending}
                onPress={() => addBarcodeMutation.mutate(newBarcode.trim())}
                style={{ marginLeft: 8 }}
              />
            </View>

            <Button
              title="Close"
              variant="secondary"
              onPress={() => setSelectedItem(null)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>

      {/* Barcode Camera Scanner */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(barcode) => {
          setSearchQuery(barcode);
        }}
      />
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
  scannerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSku: {
    fontSize: 12,
    marginTop: 2,
  },
  priceGrid: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  priceVal: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  barcodesBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  emptyBarcode: {
    fontSize: 13,
  },
  barcodeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  barcodeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  addBarcodeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
