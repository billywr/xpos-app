import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Building2,
  GitBranch,
  Moon,
  Sun,
  LogOut,
  Server,
  Monitor,
  Check,
  Shield,
  RefreshCw,
  Cloud,
  Database,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { useToast } from "@/context/ToastContext";
import { useSyncStatus } from "@/services/useSyncStatus";
import type { OutboxMutation } from "@/services/outboxEngine";
import { hydrationService } from "@/services/hydrationService";
import { fetchOrgs, fetchBranches, fetchTerminals } from "@/api/context";
import { isUuid } from "@/api/auth";
import { storage } from "@/utils/storage";
import { DEFAULT_CONFIG } from "@/constants/config";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { haptics } from "@/utils/haptics";
import type { Org, Branch, Terminal } from "@/types";

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { username, token, logout } = useAuth();
  const toast = useToast();
  const {
    isOnline,
    pendingCount,
    syncingCount,
    committedCount,
    failedCount,
    lastError,
    lastSyncedAt,
    syncNow,
    getRecentMutations,
  } = useSyncStatus();

  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isFullResyncing, setIsFullResyncing] = useState(false);
  const [recentMutations, setRecentMutations] = useState<OutboxMutation[]>([]);

  const {
    orgId,
    orgName,
    branchId,
    branchName,
    terminalId,
    terminalName,
    setOrg,
    setBranch,
    setTerminal,
  } = useOrg();

  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [keycloakUrl, setKeycloakUrl] = useState("");
  const [realm, setRealm] = useState("");
  const [clientId, setClientId] = useState("");

  const loadMutations = useCallback(async () => {
    try {
      const list = await getRecentMutations(5);
      setRecentMutations(list);
    } catch {}
  }, [getRecentMutations]);

  useEffect(() => {
    void loadMutations();
  }, [pendingCount, syncingCount, committedCount, failedCount, loadMutations]);

  useFocusEffect(
    useCallback(() => {
      void loadMutations();
    }, [loadMutations])
  );

  const formatMutationTitle = (m: OutboxMutation): string => {
    try {
      const payload = m.payload_json ? JSON.parse(m.payload_json) : {};
      switch (m.entity_type) {
        case "CATALOG_ITEM_CREATE":
          return `Add Item: ${payload.name || "Catalog Item"}`;
        case "CATALOG_ITEM_UPDATE":
          return `Update Item: ${payload.name || m.entity_id}`;
        case "STOCK_COUNT_SAVE":
          return "Saved Stock Closing Count";
        case "STOCK_COUNT_RECORD_SALES":
          return "Recorded Stock Sales";
        case "STOCK_COUNT_RECONCILE":
          return "Reconciled Inventory";
        case "GRN_CREATE":
          return "Received Stock Delivery (GRN)";
        case "GRN_UPDATE":
          return "Updated Stock Receipt";
        case "GRN_DELETE":
          return "Deleted Stock Receipt";
        case "DEBT_CREATE":
          return `Customer Debt: ${payload.customerName || "Customer"}`;
        case "DEBT_SETTLE":
          return `Debt Payment: KSh ${payload.paymentAmount || ""}`;
        case "EXPENSE_CREATE":
          return `Expense: ${payload.category || "General"} (${payload.description || ""})`;
        default:
          return `${m.action} ${m.entity_type}`;
      }
    } catch {
      return `${m.action} ${m.entity_type}`;
    }
  };

  const formatLastSync = (d: Date | null) => {
    if (!d) return "Not synced yet";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSyncNow = async () => {
    haptics.light();
    if (!isOnline) {
      toast.info("Cannot sync while offline. Changes are saved locally.", "Offline");
      return;
    }
    setIsSyncingNow(true);
    try {
      const res = await syncNow();
      if (res.failed > 0) {
        toast.info(`Sync finished: ${res.synced} sent, ${res.failed} failed.`, "Sync Alert");
      } else if (res.synced > 0) {
        toast.success(`Synchronized ${res.synced} change(s) to server.`, "Sync Completed");
      } else {
        toast.success("All local data is already up to date.", "Synced");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Sync encountered an issue.", "Sync Error");
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleFullResync = async () => {
    haptics.light();
    if (!token || !orgId || !branchId) {
      toast.error("Organization or branch context missing.", "Error");
      return;
    }
    if (!isOnline) {
      toast.info("Cannot perform full re-sync while offline.", "Offline");
      return;
    }
    setIsFullResyncing(true);
    try {
      await syncNow();
      const res = await hydrationService.hydrateAll(token, orgId, branchId);
      if (res.success) {
        toast.success("Full re-sync completed successfully.", "Data Synchronized");
      } else {
        toast.info(res.error ?? "Completed with warnings.", "Sync Notice");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to perform full re-sync.", "Error");
    } finally {
      setIsFullResyncing(false);
    }
  };

  // Reload System Info values every time the screen is focused so that
  // changes saved in the config modal are immediately reflected here.
  useFocusEffect(
    useCallback(() => {
      void storage.getApiBaseUrl().then((u) => setApiBaseUrl(u ?? DEFAULT_CONFIG.API_BASE_URL));
      void storage.getKeycloakUrl().then((u) => setKeycloakUrl(u ?? DEFAULT_CONFIG.KEYCLOAK_URL));
      void storage.getRealm().then((r) => setRealm(r ?? DEFAULT_CONFIG.KEYCLOAK_REALM));
      void storage.getClientId().then((c) => setClientId(c ?? DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID));
    }, [])
  );


  const { data: orgsData } = useQuery({
    queryKey: ["context-orgs", token],
    queryFn: () => fetchOrgs(token),
    enabled: Boolean(token),
  });
  const orgs = orgsData?.content ?? [];

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ["context-branches", token, orgId],
    queryFn: () => fetchBranches(token, orgId!),
    enabled: Boolean(token && orgId),
  });
  const branches = branchesData?.content ?? [];

  // Fetch Terminals
  const { data: terminalsData } = useQuery({
    queryKey: ["context-terminals", token, orgId, branchId],
    queryFn: () => fetchTerminals(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId),
  });
  const showOrgSelector = orgs.length > 1;
  const showBranchSelector = branches.length > 1;
  const showOrgBranchSection = showOrgSelector || showBranchSelector;

  const handleLogout = async () => {
    haptics.warning();
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.card}>
          <View style={styles.userRow}>
            <View
              style={[
                styles.avatarBox,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <User size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {username && !isUuid(username) ? username : "Operator"}
              </Text>
              <Text style={[styles.userRole, { color: colors.textMuted }]}>
                {orgName ? `${orgName}${branchName ? ` • ${branchName}` : ""}` : "XPOS Store Operator"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                toggleTheme();
              }}
              style={[styles.themeIconBtn, { backgroundColor: colors.surfaceRaised }]}
              accessibilityLabel={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {isDark ? (
                <Moon size={18} color={colors.primary} />
              ) : (
                <Sun size={18} color={colors.warning} />
              )}
            </TouchableOpacity>
          </View>
        </Card>


        {/* Organization & Branch Selection (hidden if only 1 org and 1 branch) */}
        {showOrgBranchSection ? (
          <>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              ORGANIZATION & BRANCH
            </Text>
            <Card style={styles.card}>
              {showOrgSelector ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
                    Current Organization:
                  </Text>
                  <View style={styles.chipRow}>
                    {orgs.map((o: Org) => {
                      const isSelected = orgId === o.id;
                      return (
                        <TouchableOpacity
                          key={o.id}
                          onPress={() => {
                            haptics.light();
                            void setOrg(o.id, o.name);
                          }}
                          style={[
                            styles.contextChip,
                            {
                              backgroundColor: isSelected
                                ? colors.primaryLight
                                : colors.surfaceRaised,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Building2
                            size={14}
                            color={isSelected ? colors.primary : colors.textSubtle}
                          />
                          <Text
                            style={[
                              styles.contextChipText,
                              {
                                color: isSelected ? colors.primary : colors.text,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {o.name}
                          </Text>
                          {isSelected ? (
                            <Check size={14} color={colors.primary} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Branch Selection */}
              {showBranchSelector && orgId ? (
                <View style={{ marginTop: showOrgSelector ? 16 : 0 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
                    Current Branch:
                  </Text>
                  <View style={styles.chipRow}>
                    {branches.map((b: Branch) => {
                      const isSelected = branchId === b.id;
                      return (
                        <TouchableOpacity
                          key={b.id}
                          onPress={() => {
                            haptics.light();
                            void setBranch(b.id, b.name);
                          }}
                          style={[
                            styles.contextChip,
                            {
                              backgroundColor: isSelected
                                ? colors.primaryLight
                                : colors.surfaceRaised,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <GitBranch
                            size={14}
                            color={isSelected ? colors.primary : colors.textSubtle}
                          />
                          <Text
                            style={[
                              styles.contextChipText,
                              {
                                color: isSelected ? colors.primary : colors.text,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {b.name}
                          </Text>
                          {isSelected ? (
                            <Check size={14} color={colors.primary} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}


        {/* Data & Synchronization */}
        <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
          DATA & SYNCHRONIZATION
        </Text>
        <Card style={styles.card}>
          <View style={styles.syncHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Database size={18} color={colors.primary} />
              <Text style={[styles.syncTitle, { color: colors.text }]}>
                Local-First Engine
              </Text>
            </View>
            <View
              style={[
                styles.onlineBadge,
                {
                  backgroundColor: !isOnline
                    ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2")
                    : (isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5"),
                  borderColor: !isOnline ? colors.danger : colors.success,
                },
              ]}
            >
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: !isOnline ? colors.danger : colors.success },
                ]}
              />
              <Text
                style={[
                  styles.onlineText,
                  { color: !isOnline ? colors.danger : colors.success },
                ]}
              >
                {isOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 12 }]}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Pending Changes:
            </Text>
            <Text
              style={[
                styles.infoVal,
                {
                  color: pendingCount > 0 ? colors.warning : colors.text,
                  fontWeight: pendingCount > 0 ? "700" : "600",
                },
              ]}
            >
              {syncingCount > 0 ? `Syncing (${syncingCount})…` : `${pendingCount} queued`}
            </Text>
          </View>

          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Synced Changes:
            </Text>
            <Text style={[styles.infoVal, { color: colors.success, fontWeight: "600" }]}>
              {committedCount} synchronized
            </Text>
          </View>

          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Sync Cadence:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              Every 5s (deltas only)
            </Text>
          </View>

          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Last Synchronized:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {formatLastSync(lastSyncedAt)}
            </Text>
          </View>

          {lastError ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#fef3c7" },
              ]}
            >
              <AlertTriangle size={14} color={colors.warning} />
              <Text style={[styles.errorText, { color: colors.warning }]} numberOfLines={2}>
                {lastError}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Button
              title="Sync Now"
              variant="primary"
              size="md"
              loading={isSyncingNow || syncingCount > 0}
              icon={<RefreshCw size={15} color="#ffffff" />}
              onPress={handleSyncNow}
              style={{ flex: 1 }}
            />
            <Button
              title="Full Re-sync"
              variant="outline"
              size="md"
              loading={isFullResyncing}
              icon={<Cloud size={15} color={colors.text} />}
              onPress={handleFullResync}
              style={{ flex: 1 }}
            />
          </View>

          {/* Recent changes tracked in outbox queue */}
          <View style={[styles.activitySection, { borderTopColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[styles.activityHeading, { color: colors.textSubtle }]}>
                RECENT TRACKED CHANGES
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {recentMutations.length} logged
              </Text>
            </View>

            {recentMutations.length === 0 ? (
              <Text style={[styles.noActivityText, { color: colors.textMuted }]}>
                No local changes recorded yet.
              </Text>
            ) : (
              recentMutations.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.mutationRow,
                    { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" },
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.mutationTitle, { color: colors.text }]} numberOfLines={1}>
                      {formatMutationTitle(m)}
                    </Text>
                    <Text style={[styles.mutationTime, { color: colors.textMuted }]}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </Text>
                  </View>
                  <Badge
                    label={
                      m.status === "COMMITTED"
                        ? "Synced"
                        : m.status === "SYNCING"
                        ? "Syncing…"
                        : m.status === "PENDING"
                        ? "Queued"
                        : "Failed"
                    }
                    variant={
                      m.status === "COMMITTED"
                        ? "primary"
                        : m.status === "FAILED"
                        ? "danger"
                        : "warning"
                    }
                    size="sm"
                  />
                </View>
              ))
            )}
          </View>
        </Card>

        {/* Server & Connectivity */}
        <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
          SYSTEM INFO
        </Text>
        <Card style={styles.card}>
          <View style={styles.infoRow}>
            <Server size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Backend Server:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {apiBaseUrl}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Server size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Keycloak IAM:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {keycloakUrl}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Shield size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Realm / Client:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {realm} / {clientId}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Monitor size={16} color={colors.textSubtle} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              Terminal:
            </Text>
            <Text style={[styles.infoVal, { color: colors.text }]}>
              {terminalName || (terminalId && !isUuid(terminalId) ? terminalId : "Main Terminal")}
            </Text>
          </View>
          {orgName ? (
            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <Building2 size={16} color={colors.textSubtle} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                Organization:
              </Text>
              <Text style={[styles.infoVal, { color: colors.text }]}>
                {orgName}
              </Text>
            </View>
          ) : null}
          {branchName ? (
            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <GitBranch size={16} color={colors.textSubtle} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                Branch:
              </Text>
              <Text style={[styles.infoVal, { color: colors.text }]}>
                {branchName}
              </Text>
            </View>
          ) : null}

          <Button
            title="Configure Server Endpoints"
            variant="secondary"
            icon={<Server size={16} color={colors.text} />}
            onPress={() => {
              haptics.light();
              router.push("/server-config");
            }}
            style={{ marginTop: 12 }}
          />
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out"
          variant="danger"
          icon={<LogOut size={18} color="#ffffff" />}
          onPress={handleLogout}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  card: {
    padding: 16,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  contextChipText: {
    fontSize: 13,
  },
  themeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  syncHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150, 150, 150, 0.2)",
  },
  syncTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  activitySection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  activityHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  noActivityText: {
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 6,
  },
  mutationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mutationTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  mutationTime: {
    fontSize: 11,
    marginTop: 2,
  },
});
