import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldAlert,
} from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { systemErrorLogger, SystemErrorLog } from "@/services/systemErrorLogger";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/utils/haptics";

interface ErrorLogsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ErrorLogsModal: React.FC<ErrorLogsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const toast = useToast();

  const [errors, setErrors] = useState<SystemErrorLog[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadErrors = useCallback(async () => {
    const list = await systemErrorLogger.getRecentErrors(10);
    setErrors(list);
  }, []);

  useEffect(() => {
    if (visible) {
      void loadErrors();
    }
  }, [visible, loadErrors]);

  useEffect(() => {
    const unsubscribe = systemErrorLogger.subscribe((latest) => {
      setErrors(latest);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const toggleExpand = (id: string) => {
    haptics.selection();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClear = async () => {
    haptics.light();
    await systemErrorLogger.clearErrors();
    toast.success("Error logs cleared.");
  };

  const handleCopy = (text: string, label: string) => {
    haptics.light();
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard.`);
    } else {
      toast.info(`${label}: ${text.slice(0, 35)}…`);
    }
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
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={20} color={colors.danger} />
              <Text style={[styles.title, { color: colors.text }]}>System Failure & Error Logs</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSubtle }]}>
              Up to 10 most recent system and API failures
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={loadErrors}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              accessibilityLabel="Refresh error logs"
            >
              <RefreshCw size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              accessibilityLabel="Close error logs"
            >
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action bar / status banner */}
        <View style={[styles.statusBar, { borderBottomColor: colors.border, backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#f8fafc" }]}>
          <Text style={[styles.statusText, { color: colors.textMuted }]}>
            Recorded Failures: <Text style={{ fontWeight: "700", color: errors.length > 0 ? colors.danger : colors.text }}>{errors.length} / 10</Text>
          </Text>
          {errors.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              style={[styles.clearBtn, { borderColor: colors.border }]}
            >
              <Trash2 size={13} color={colors.danger} />
              <Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear Logs</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Error List */}
        {errors.length === 0 ? (
          <View style={styles.centered}>
            <AlertTriangle size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No System Errors Recorded</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Any backend HTTP 4xx/5xx errors, sync failures, or network timeouts will be captured here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={errors}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isExpanded = expandedIds.has(item.id);
              return (
                <Card style={[styles.card, { borderColor: isExpanded ? colors.danger : colors.border }]}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleExpand(item.id)}
                    style={styles.cardHeader}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Badge
                          label={item.error_code}
                          variant="danger"
                          size="sm"
                        />
                        {item.status > 0 && (
                          <Badge
                            label={`Status ${item.status}`}
                            variant="neutral"
                            size="sm"
                          />
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                          <Clock size={11} color={colors.textMuted} />
                          <Text style={[styles.timeText, { color: colors.textMuted }]}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.cardMessage, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
                        {item.message}
                      </Text>
                      {item.source && (
                        <Text style={[styles.cardSource, { color: colors.textMuted }]} numberOfLines={1}>
                          Source: {item.source}
                        </Text>
                      )}
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={16} color={colors.textMuted} />
                    ) : (
                      <ChevronDown size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
                      {item.request_id && (
                        <View style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: colors.textSubtle }]}>Request ID:</Text>
                          <TouchableOpacity
                            onPress={() => handleCopy(item.request_id!, "Request ID")}
                            style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}
                          >
                            <Text style={[styles.detailValueCode, { color: colors.text }]} numberOfLines={1}>
                              {item.request_id}
                            </Text>
                            <Copy size={12} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSubtle }]}>Timestamp:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {new Date(item.created_at).toLocaleString()}
                        </Text>
                      </View>
                      {item.details_json && (
                        <View style={{ marginTop: 8 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <Text style={[styles.detailLabel, { color: colors.textSubtle }]}>Details / Payload:</Text>
                            <TouchableOpacity
                              onPress={() => handleCopy(item.details_json!, "Error details")}
                              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                            >
                              <Copy size={11} color={colors.primary} />
                              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Copy</Text>
                            </TouchableOpacity>
                          </View>
                          <ScrollView
                            horizontal
                            style={[
                              styles.codeBox,
                              { backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "#f1f5f9" },
                            ]}
                          >
                            <Text style={[styles.codeText, { color: colors.text }]}>
                              {formatJson(item.details_json)}
                            </Text>
                          </ScrollView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
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
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusText: {
    fontSize: 12,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    gap: 10,
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
  timeText: {
    fontSize: 11,
  },
  cardMessage: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
    lineHeight: 18,
  },
  cardSource: {
    fontSize: 11,
    marginTop: 3,
  },
  expandedContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    width: 80,
  },
  detailValue: {
    fontSize: 12,
    flex: 1,
  },
  detailValueCode: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  codeBox: {
    borderRadius: 6,
    padding: 8,
    maxHeight: 140,
  },
  codeText: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
