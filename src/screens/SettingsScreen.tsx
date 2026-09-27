import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  Building2,
  GitBranch,
  Moon,
  Sun,
  Database,
  RefreshCw,
  Trash2,
  Sparkles,
  Package,
  ShoppingCart,
  Receipt,
  DollarSign,
  Edit2,
  CheckCircle2,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { useToast } from "@/context/ToastContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";
import { ScalePressable } from "@/components/ui/ScalePressable";
import { haptics } from "@/utils/haptics";
import { getDatabase, withTransaction } from "@/db/database";
import { seedDatabase } from "@/db/seed";

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { username, setUsername } = useAuth();
  const { orgName, branchName, setOrg, setBranch } = useOrg();
  const toast = useToast();

  const [counts, setCounts] = useState({
    items: 0,
    grns: 0,
    sales: 0,
    debts: 0,
    expenses: 0,
  });

  const [editStoreModal, setEditStoreModal] = useState(false);
  const [formStoreName, setFormStoreName] = useState(orgName || "My Store");
  const [formBranchName, setFormBranchName] = useState(branchName || "Main Store");
  const [formOperatorName, setFormOperatorName] = useState(username || "Store Manager");

  const loadDatabaseStats = useCallback(async () => {
    try {
      const db = await getDatabase();
      const itemCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM items");
      const grnCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM goods_receipt_notes");
      const saleCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM sales");
      const debtCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM customer_debts");
      const expCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM misc_expenses");

      setCounts({
        items: itemCount?.count ?? 0,
        grns: grnCount?.count ?? 0,
        sales: saleCount?.count ?? 0,
        debts: debtCount?.count ?? 0,
        expenses: expCount?.count ?? 0,
      });
    } catch (err) {
      console.warn("Failed to load db stats:", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDatabaseStats();
    }, [loadDatabaseStats])
  );

  const handleSaveStoreProfile = async () => {
    if (!formStoreName.trim()) return;
    await setOrg("offline-org", formStoreName.trim());
    await setBranch("offline-branch", formBranchName.trim() || "Main Store");
    if (formOperatorName.trim()) {
      setUsername(formOperatorName.trim());
    }
    setEditStoreModal(false);
    toast.success("Store profile updated.");
  };

  const handleSeedDemoData = async () => {
    try {
      haptics.light();
      const db = await getDatabase();
      await seedDatabase(db, { force: true });
      await loadDatabaseStats();
      toast.success("Sample demo data loaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to seed demo data");
    }
  };

  const handleResetDatabase = () => {
    Alert.alert(
      "Reset Local Database?",
      "This will erase all products, receipts, sales, debts, and expenses stored on this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase All Data",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await withTransaction(async (tx) => {
                await tx.execAsync(`
                  DELETE FROM sale_lines;
                  DELETE FROM sales;
                  DELETE FROM stock_count_lines;
                  DELETE FROM stock_count_sheets;
                  DELETE FROM grn_lines;
                  DELETE FROM goods_receipt_notes;
                  DELETE FROM debt_payments;
                  DELETE FROM customer_debts;
                  DELETE FROM misc_expenses;
                  DELETE FROM items;
                `);
              });
              await loadDatabaseStats();
              toast.success("Database reset to clean factory state.");
            } catch (err: any) {
              toast.error(err.message || "Failed to reset database");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Store Profile Card */}
        <Card style={styles.card}>
          <View style={styles.userRow}>
            <View style={[styles.avatarBox, { backgroundColor: colors.primaryLight }]}>
              <Building2 size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {orgName || "My Store"}
                </Text>
                <Badge label="Offline" variant="primary" size="sm" />
              </View>
              <Text style={[styles.userRole, { color: colors.textMuted }]}>
                {branchName || "Main Store"} · Operator: {username || "Store Manager"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setFormStoreName(orgName || "My Store");
                setFormBranchName(branchName || "Main Store");
                setFormOperatorName(username || "Store Manager");
                setEditStoreModal(true);
              }}
              style={[styles.editIconBtn, { backgroundColor: colors.surfaceRaised }]}
            >
              <Edit2 size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Database Status Section */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          LOCAL DATABASE STATISTICS
        </Text>
        <Card style={styles.card}>
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <View style={styles.statHeader}>
                <Package size={15} color={colors.primary} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Products</Text>
              </View>
              <Text style={[styles.statVal, { color: colors.text }]}>{counts.items}</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.statHeader}>
                <Receipt size={15} color={colors.accent} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Receipts (GRN)</Text>
              </View>
              <Text style={[styles.statVal, { color: colors.text }]}>{counts.grns}</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.statHeader}>
                <ShoppingCart size={15} color={colors.warning} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sales</Text>
              </View>
              <Text style={[styles.statVal, { color: colors.text }]}>{counts.sales}</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.statHeader}>
                <DollarSign size={15} color={colors.danger} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Debts & Exp</Text>
              </View>
              <Text style={[styles.statVal, { color: colors.text }]}>
                {counts.debts + counts.expenses}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Data Management Actions */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          OFFLINE DATA TOOLS
        </Text>
        <Card style={styles.card}>
          <TouchableOpacity
            onPress={handleSeedDemoData}
            style={[styles.actionRow, { borderBottomColor: colors.border }]}
          >
            <View style={styles.actionLeft}>
              <Sparkles size={20} color={colors.primary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Load Demo Data
                </Text>
                <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                  Populate 5 sample products, supplier, debt, and expense
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={loadDatabaseStats}
            style={[styles.actionRow, { borderBottomColor: colors.border }]}
          >
            <View style={styles.actionLeft}>
              <RefreshCw size={20} color={colors.textMuted} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Refresh Statistics
                </Text>
                <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                  Recalculate local SQLite record counts
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResetDatabase} style={styles.actionRowLast}>
            <View style={styles.actionLeft}>
              <Trash2 size={20} color={colors.danger} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.actionTitle, { color: colors.danger }]}>
                  Reset Database
                </Text>
                <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                  Clear all local records and return to factory state
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Card>

        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          PREFERENCES
        </Text>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              {isDark ? (
                <Moon size={20} color={colors.primary} />
              ) : (
                <Sun size={20} color={colors.primary} />
              )}
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Dark Mode
              </Text>
            </View>
            <Button
              title={isDark ? "Dark" : "Light"}
              variant="outline"
              size="sm"
              onPress={() => {
                haptics.light();
                toggleTheme();
              }}
            />
          </View>
        </Card>

        {/* System Info */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          SYSTEM INFO
        </Text>
        <Card style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Engine</Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>SQLite 3 (expo-sqlite)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Storage Mode</Text>
            <Text style={[styles.infoVal, { color: colors.primary }]}>100% Standalone Offline</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>App Version</Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>1.0.0 (offline-v)</Text>
          </View>
        </Card>
      </ScrollView>

      {/* Edit Store Profile Modal */}
      <Modal
        visible={editStoreModal}
        animationType="slide"
        transparent
        onRequestClose={() => setEditStoreModal(false)}
      >
        <AnimatedModalBackdrop
          style={styles.modalBackdrop}
          onPressBackdrop={() => setEditStoreModal(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Store Profile</Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Customize your business identity stored locally on this phone.
            </Text>

            <Input
              label="Store / Business Name *"
              value={formStoreName}
              onChangeText={setFormStoreName}
              placeholder="e.g. Mama Mary Groceries"
            />
            <Input
              label="Branch Name"
              value={formBranchName}
              onChangeText={setFormBranchName}
              placeholder="e.g. Westlands Branch"
            />
            <Input
              label="Operator / Cashier Name"
              value={formOperatorName}
              onChangeText={setFormOperatorName}
              placeholder="e.g. Mary Wanjiku"
            />

            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setEditStoreModal(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Profile"
                variant="primary"
                onPress={handleSaveStoreProfile}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 18,
    marginLeft: 4,
  },
  card: {
    padding: 16,
    borderRadius: 14,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
  },
  userRole: {
    fontSize: 13,
    marginTop: 2,
  },
  editIconBtn: {
    padding: 8,
    borderRadius: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCol: {
    flex: 1,
    minWidth: "45%",
    padding: 8,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  statVal: {
    fontSize: 22,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionRowLast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionSub: {
    fontSize: 12,
    marginTop: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalBtns: {
    flexDirection: "row",
    marginTop: 16,
  },
});
