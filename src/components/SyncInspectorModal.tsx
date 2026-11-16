import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Copy,
  ChevronDown,
  ChevronUp,
  Server,
  Terminal,
  RotateCcw,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { outboxEngine, OutboxMutation } from "@/services/outboxEngine";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/utils/haptics";

interface SyncInspectorModalProps {
  visible: boolean;
  onClose: () => void;
  initialSelectedId?: string | null;
}

export const SyncInspectorModal: React.FC<SyncInspectorModalProps> = ({
  visible,
  onClose,
  initialSelectedId,
}) => {
  const { colors, isDark } = useTheme();
  const toast = useToast();

  const [mutations, setMutations] = useState<OutboxMutation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "COMMITTED" | "PENDING" | "FAILED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadMutations = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await outboxEngine.getRecentMutations(5);
      setMutations(items);
      if (initialSelectedId) {
        setExpandedIds((prev) => new Set([...prev, initialSelectedId]));
      }
    } finally {
      setIsLoading(false);
    }
  }, [initialSelectedId]);

  useEffect(() => {
    if (visible) {
      void loadMutations();
    }
  }, [visible, loadMutations]);

  const toggleExpand = (id: string) => {
    haptics.selection();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRetry = async (id: string) => {
    haptics.light();
    setRetryingId(id);
    try {
      await outboxEngine.retryMutation(id);
      toast.info("Mutation requeued for background synchronization.", "Retry Initiated");
      await loadMutations();
    } catch {
      toast.error("Failed to requeue mutation.", "Error");
    } finally {
      setRetryingId(null);
    }
  };

  const handleCopy = (text: string, label: string) => {
    haptics.light();
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard.`);
    } else {
      toast.info(`${label}: ${text.slice(0, 40)}…`);
    }
  };

  const filteredMutations = useMemo(() => {
    return mutations.filter((m) => {
      if (filter === "COMMITTED" && m.status !== "COMMITTED") return false;
      if (filter === "PENDING" && m.status !== "PENDING" && m.status !== "SYNCING") return false;
      if (filter === "FAILED" && m.status !== "FAILED") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        m.entity_type.toLowerCase().includes(q) ||
        m.action.toLowerCase().includes(q) ||
        m.endpoint.toLowerCase().includes(q) ||
        m.client_request_id.toLowerCase().includes(q) ||
        (m.payload_json && m.payload_json.toLowerCase().includes(q)) ||
        (m.response_json && m.response_json.toLowerCase().includes(q)) ||
        (m.last_error && m.last_error.toLowerCase().includes(q))
      );
    });
  }, [mutations, filter, searchQuery]);

  const stats = useMemo(() => {
    let committed = 0;
    let pending = 0;
    let failed = 0;
    mutations.forEach((m) => {
      if (m.status === "COMMITTED") committed++;
      else if (m.status === "FAILED") failed++;
      else pending++;
    });
    return { all: mutations.length, committed, pending, failed };
  }, [mutations]);

  const formatTitle = (m: OutboxMutation) => {
    try {
      const payload = JSON.parse(m.payload_json);
      if (m.entity_type === "STOCK_COUNT_SAVE") {
        return `Stock Count: ${payload.date || "Count"} (${payload.counts?.length || 1} items)`;
      }
      if (m.entity_type === "CATALOG_ITEM_CREATE") {
        return `Add Item: ${payload.name || m.entity_id}`;
      }
      if (m.entity_type === "CATALOG_ITEM_UPDATE") {
        return `Edit Item: ${payload.name || m.entity_id}`;
      }
      if (m.entity_type === "STOCK_RECEIPT_SAVE") {
        return `Goods Receipt: ${payload.supplierName || payload.invoiceNumber || "Delivery"}`;
      }
      if (m.entity_type === "CUSTOMER_DEBT_CREATE") {
        return `Add Debt: ${payload.customerName || "Customer"}`;
      }
      if (m.entity_type === "MISC_EXPENSE_CREATE") {
        return `Add Expense: ${payload.category || "General"} (KES ${payload.amount})`;
      }
    } catch {}
    return `${m.action} ${m.entity_type}`;
  };

  const formatJson = (str: string | null | undefined): string => {
    if (!str) return "None";
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Terminal size={20} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Sync API Inspector</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSubtle }]}>
              Last 5 sync events & backend API audit trail
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={loadMutations}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              accessibilityLabel="Refresh sync logs"
            >
              <RefreshCw size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              accessibilityLabel="Close sync inspector"
            >
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(
            [
              { key: "ALL", label: `All (${stats.all})` },
              { key: "COMMITTED", label: `Synced (${stats.committed})` },
              { key: "PENDING", label: `Queued (${stats.pending})` },
              { key: "FAILED", label: `Failed (${stats.failed})` },
            ] as const
          ).map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => {
                  haptics.selection();
                  setFilter(item.key);
                }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceCard,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: active ? "#ffffff" : colors.textSubtle, fontWeight: active ? "700" : "500" },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search Input */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by entity, endpoint, response, or Request ID…"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* List of mutations */}
        {isLoading && mutations.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading sync history…</Text>
          </View>
        ) : filteredMutations.length === 0 ? (
          <View style={styles.centered}>
            <CheckCircle2 size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No records match criteria</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              All offline mutations will be logged and inspectable here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredMutations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isExpanded = expandedIds.has(item.id);
              const isRetrying = retryingId === item.id;
              const hasResponse = Boolean(item.response_json);
              const hasError = Boolean(item.last_error);

              return (
                <Card style={[styles.card, { borderColor: isExpanded ? colors.primary : colors.border }]}>
                  {/* Card Header */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleExpand(item.id)}
                    style={styles.cardHeader}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Text style={[styles.methodBadge, { color: colors.primary }]}>{item.http_method}</Text>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                          {formatTitle(item)}
                        </Text>
                      </View>
                      <Text style={[styles.cardEndpoint, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.endpoint}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      {item.status === "COMMITTED" ? (
                        <Badge
                          label={item.http_status ? `${item.http_status} OK` : "Synced"}
                          variant="primary"
                          size="sm"
                        />
                      ) : item.status === "FAILED" ? (
                        <Badge
                          label={item.http_status ? `${item.http_status} FAIL` : "Failed"}
                          variant="danger"
                          size="sm"
                        />
                      ) : item.status === "SYNCING" ? (
                        <Badge label="Syncing…" variant="warning" size="sm" pulse />
                      ) : (
                        <Badge label="Queued" variant="warning" size="sm" />
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={[styles.timeText, { color: colors.textMuted }]}>
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </Text>
                        {isExpanded ? (
                          <ChevronUp size={16} color={colors.textMuted} />
                        ) : (
                          <ChevronDown size={16} color={colors.textMuted} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Inspector Panel */}
                   {isExpanded && (
                    <View style={[styles.expandedPanel, { borderTopColor: colors.border }]}>
                      {/* Meta stats */}
                      <View style={styles.metaGrid}>
                        <View style={styles.metaItem}>
                          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>HTTP Status Code</Text>
                          <Text
                            style={[
                              styles.metaValue,
                              {
                                color:
                                  item.http_status && item.http_status < 400
                                    ? colors.success
                                    : item.http_status
                                    ? colors.danger
                                    : item.status === "COMMITTED"
                                    ? colors.success
                                    : colors.text,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {item.http_status
                              ? `${item.http_status}`
                              : item.status === "COMMITTED"
                              ? "2xx (legacy)"
                              : "Pending Network Call"}
                          </Text>
                        </View>

                        <View style={styles.metaItem}>
                          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Synced At</Text>
                          <Text style={[styles.metaValue, { color: colors.text }]}>
                            {item.synced_at
                              ? new Date(item.synced_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : "Not yet synced"}
                          </Text>
                        </View>
                      </View>

                      {/* Request ID */}
                      <View style={styles.codeSection}>
                        <View style={styles.codeHeader}>
                          <Text style={[styles.codeTitle, { color: colors.textMuted }]}>
                            CLIENT REQUEST ID (X-Request-Id)
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleCopy(item.client_request_id, "Request ID")}
                            style={styles.copyBtn}
                          >
                            <Copy size={12} color={colors.primary} />
                            <Text style={[styles.copyText, { color: colors.primary }]}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.requestIdText, { color: colors.text }]}>{item.client_request_id}</Text>
                      </View>

                      {/* Backend Response Payload / Status Message */}
                      <View style={styles.codeSection}>
                        <View style={styles.codeHeader}>
                          <Text
                            style={[
                              styles.codeTitle,
                              {
                                color: hasError
                                  ? colors.danger
                                  : item.status === "COMMITTED"
                                  ? colors.success
                                  : colors.textMuted,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {hasError ? "BACKEND ERROR MESSAGE" : "BACKEND API RESPONSE (RETURNED)"}
                          </Text>
                          {hasResponse && (
                            <TouchableOpacity
                              onPress={() => handleCopy(formatJson(item.response_json), "API Response")}
                              style={styles.copyBtn}
                            >
                              <Copy size={12} color={colors.primary} />
                              <Text style={[styles.copyText, { color: colors.primary }]}>Copy</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View
                          style={[
                            styles.codeBlock,
                            {
                              backgroundColor: isDark ? "#090d16" : "#f1f5f9",
                              borderColor: hasError ? colors.danger : colors.border,
                            },
                          ]}
                        >
                          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
                            <Text
                              style={[
                                styles.codeContent,
                                {
                                  color: hasError
                                    ? colors.danger
                                    : item.status === "COMMITTED" && !hasResponse
                                    ? colors.success
                                    : isDark
                                    ? "#38bdf8"
                                    : "#0369a1",
                                },
                              ]}
                            >
                              {item.response_json
                                ? formatJson(item.response_json)
                                : item.last_error
                                ? item.last_error
                                : item.status === "COMMITTED"
                                ? "✓ Successfully synced to server.\n(Response body not captured — this mutation was synced before API response logging was enabled.)"
                                : "No response yet (waiting in outbox queue)"}
                            </Text>
                          </ScrollView>
                        </View>
                      </View>

                      {/* Request Payload Sent */}
                      <View style={styles.codeSection}>
                        <View style={styles.codeHeader}>
                          <Text style={[styles.codeTitle, { color: colors.textMuted }]}>
                            REQUEST PAYLOAD (SENT TO SERVER)
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleCopy(formatJson(item.payload_json), "Request Payload")}
                            style={styles.copyBtn}
                          >
                            <Copy size={12} color={colors.primary} />
                            <Text style={[styles.copyText, { color: colors.primary }]}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                        <View
                          style={[
                            styles.codeBlock,
                            { backgroundColor: isDark ? "#090d16" : "#f1f5f9", borderColor: colors.border },
                          ]}
                        >
                          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
                            <Text style={[styles.codeContent, { color: colors.textMuted }]}>
                              {formatJson(item.payload_json)}
                            </Text>
                          </ScrollView>
                        </View>
                      </View>

                      {/* Retry Action — only for non-committed mutations */}
                      {item.status !== "COMMITTED" && (
                        <View style={{ marginTop: 12 }}>
                          <Button
                            title="Retry This Mutation Now"
                            size="sm"
                            variant="secondary"
                            loading={isRetrying}
                            onPress={() => handleRetry(item.id)}
                            icon={<RotateCcw size={14} color={colors.text} />}
                          />
                        </View>
                      )}
                    </View>

                  )}
                </Card>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  methodBadge: {
    fontSize: 11,
    fontWeight: "800",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  cardEndpoint: {
    fontSize: 11,
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
  },
  expandedPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
  },
  codeSection: {
    marginTop: 10,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  codeTitle: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  copyText: {
    fontSize: 11,
    fontWeight: "600",
  },
  requestIdText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  codeBlock: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 180,
  },
  codeContent: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
});
