import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  Plus,
  Tag,
  Package,
  CheckCircle2,
  XCircle,
  Camera,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { fetchItemBarcodes, addItemBarcode } from "@/api/catalog";
import { formatCurrency } from "@/utils/formatCurrency";
import { haptics } from "@/utils/haptics";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

export default function ProductDetailScreen() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { orgId } = useOrg();
  const router = useRouter();
  const queryClient = useQueryClient();

  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    sku?: string;
    price?: string;
    category?: string;
    active?: string;
  }>();

  const itemId = params.id;
  const itemName = params.name || "Product Details";
  const itemSku = params.sku || "N/A";
  const itemPrice = params.price ? Number(params.price) : 0;
  const itemCategory = params.category || "";
  const isActive = params.active !== "0";

  const [newBarcode, setNewBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Fetch barcodes
  const {
    data: barcodes = [],
    isLoading: barcodesLoading,
    refetch,
  } = useQuery({
    queryKey: ["item-barcodes", token, orgId, itemId],
    queryFn: () => fetchItemBarcodes(token, orgId!, itemId),
    enabled: Boolean(token && orgId && itemId),
  });

  // Add barcode mutation
  const addMutation = useMutation({
    mutationFn: (code: string) => addItemBarcode(token, orgId!, itemId, code),
    onSuccess: () => {
      haptics.success();
      setNewBarcode("");
      void refetch();
      void queryClient.invalidateQueries({
        queryKey: ["item-barcodes", token, orgId, itemId],
      });
      Alert.alert("Success", "Barcode registered successfully.");
    },
    onError: (err: any) => {
      haptics.error();
      Alert.alert("Error", err?.message || "Failed to add barcode.");
    },
  });

  const handleAddBarcode = (codeToAdd?: string) => {
    const code = (codeToAdd ?? newBarcode).trim();
    if (!code) {
      Alert.alert("Invalid Input", "Please enter or scan a barcode.");
      return;
    }
    addMutation.mutate(code);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Product Overview Card */}
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>{itemName}</Text>
            <Text style={[styles.sku, { color: colors.textSubtle }]}>
              SKU: {itemSku}
            </Text>
          </View>
          <Text style={[styles.price, { color: colors.primary }]}>
            {formatCurrency(itemPrice)}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          {itemCategory ? (
            <Badge label={itemCategory} variant="neutral" size="sm" />
          ) : null}
          <Badge
            label={isActive ? "Active" : "Inactive"}
            variant={isActive ? "primary" : "danger"}
            size="sm"
          />
        </View>
      </Card>

      {/* Barcodes Section */}
      <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
        ATTACHED BARCODES ({barcodes.length})
      </Text>
      <Card style={styles.card}>
        {barcodesLoading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ padding: 12 }}
          />
        ) : barcodes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Barcode size={32} color={colors.textSubtle} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No barcodes registered for this product yet.
            </Text>
          </View>
        ) : (
          barcodes.map((b) => (
            <View
              key={b.id}
              style={[
                styles.barcodeItem,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              <Barcode size={18} color={colors.textSubtle} />
              <Text style={[styles.barcodeCode, { color: colors.text }]}>
                {b.barcode}
              </Text>
              {b.primaryBarcode ? (
                <Badge label="Primary" variant="accent" size="sm" />
              ) : null}
            </View>
          ))
        )}

        {/* Add barcode form */}
        <View style={styles.addBarcodeBox}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Input
              label="New Barcode"
              value={newBarcode}
              onChangeText={setNewBarcode}
              placeholder="Enter digits or scan"
              keyboardType="numeric"
              autoCapitalize="none"
              leftIcon={<Barcode size={16} color={colors.textSubtle} />}
            />
          </View>
          <TouchableOpacity
            onPress={() => setScannerOpen(true)}
            style={[
              styles.scanBtn,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <Camera size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <Button
          title="Add Barcode"
          variant="primary"
          icon={<Plus size={16} color="#ffffff" />}
          loading={addMutation.isPending}
          onPress={() => handleAddBarcode()}
          style={{ marginTop: 8 }}
        />
      </Card>

      {/* Barcode scanner modal */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setScannerOpen(false);
          handleAddBarcode(code);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  sku: {
    fontSize: 13,
    marginTop: 2,
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 12,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  emptyBox: {
    alignItems: "center",
    padding: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  barcodeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  barcodeCode: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    fontFamily: "monospace",
  },
  addBarcodeBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 8,
  },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
});
