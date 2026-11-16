import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ChevronDown, Plus, Trash2, Check, X, Search } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import {
  readSavedUtilityPresets,
  addUtilityPreset,
  removeUtilityPreset,
} from "@/utils/utilityPresetsStorage";
import { haptics } from "@/utils/haptics";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";

interface UtilityPresetSelectorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  orgId: string;
  branchId: string;
}

export const UtilityPresetSelector: React.FC<UtilityPresetSelectorProps> = ({
  label = "Utility Name *",
  value,
  onChange,
  orgId,
  branchId,
}) => {
  const { colors } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [presets, setPresets] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [newPresetName, setNewPresetName] = useState("");

  const loadPresets = useCallback(async () => {
    if (!orgId || !branchId) return;
    const list = await readSavedUtilityPresets(orgId, branchId, value ? [value] : []);
    setPresets(list);
  }, [orgId, branchId, value]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const handleOpen = () => {
    haptics.light();
    setSearchFilter("");
    setNewPresetName("");
    void loadPresets();
    setModalOpen(true);
  };

  const handleSelect = (preset: string) => {
    haptics.selection();
    onChange(preset);
    setModalOpen(false);
  };

  const handleAddPreset = async () => {
    const trimmed = (newPresetName || searchFilter).trim();
    if (!trimmed || !orgId || !branchId) return;
    haptics.light();
    const updated = await addUtilityPreset(orgId, branchId, trimmed);
    setPresets(updated);
    onChange(trimmed);
    setNewPresetName("");
    setSearchFilter("");
    setModalOpen(false);
  };

  const handleDeletePreset = async (preset: string) => {
    if (!orgId || !branchId) return;
    haptics.medium();
    const updated = await removeUtilityPreset(orgId, branchId, preset);
    setPresets(updated);
    if (value === preset) {
      onChange("");
    }
  };

  const filteredPresets = presets.filter((p) =>
    p.toLowerCase().includes(searchFilter.trim().toLowerCase())
  );

  const exactMatchExists = presets.some(
    (p) => p.localeCompare(searchFilter.trim(), undefined, { sensitivity: "base" }) === 0
  );

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}

      <TouchableOpacity
        onPress={handleOpen}
        activeOpacity={0.7}
        style={[
          styles.triggerBtn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            { color: value ? colors.text : colors.textSubtle },
          ]}
          numberOfLines={1}
        >
          {value || "Select or enter utility name…"}
        </Text>
        <ChevronDown size={18} color={colors.textSubtle} />
      </TouchableOpacity>

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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboardAvoid}
          >
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Header */}
              <View style={styles.headerRow}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Utility Preset
                </Text>
                <TouchableOpacity
                  onPress={() => setModalOpen(false)}
                  style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Search / Custom Input */}
              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Search size={16} color={colors.textSubtle} />
                <TextInput
                  value={searchFilter}
                  onChangeText={setSearchFilter}
                  placeholder="Search or enter custom bill name…"
                  placeholderTextColor={colors.textSubtle}
                  style={[styles.searchInput, { color: colors.text }]}
                  autoCapitalize="words"
                />
                {searchFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchFilter("")}>
                    <X size={16} color={colors.textSubtle} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Add Custom / New Preset Action Banner */}
              {searchFilter.trim().length > 0 && !exactMatchExists && (
                <TouchableOpacity
                  onPress={handleAddPreset}
                  activeOpacity={0.8}
                  style={[
                    styles.addNewBanner,
                    {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Plus size={16} color={colors.primary} />
                  <Text style={[styles.addNewText, { color: colors.primary }]}>
                    Add & select "{searchFilter.trim()}"
                  </Text>
                </TouchableOpacity>
              )}

              {/* Presets List */}
              <FlatList
                data={filteredPresets}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isSelected = item.toLowerCase() === value.trim().toLowerCase();
                  return (
                    <View
                      style={[
                        styles.presetRow,
                        {
                          backgroundColor: isSelected ? colors.surfaceRaised : "transparent",
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => handleSelect(item)}
                        style={styles.presetSelectArea}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.presetName,
                            {
                              color: isSelected ? colors.primary : colors.text,
                              fontWeight: isSelected ? "700" : "500",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                        {isSelected && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeletePreset(item)}
                        style={[
                          styles.deleteBtn,
                          { backgroundColor: colors.surfaceRaised },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Delete ${item}`}
                      >
                        <Trash2 size={15} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.textSubtle }]}>
                      No presets found.
                    </Text>
                  </View>
                }
              />
            </View>
          </KeyboardAvoidingView>
        </AnimatedModalBackdrop>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  triggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  triggerText: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalKeyboardAvoid: {
    width: "100%",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderTopWidth: 1,
    maxHeight: 520,
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  addNewBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
  },
  addNewText: {
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    maxHeight: 340,
  },
  listContent: {
    paddingBottom: 16,
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  presetSelectArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 10,
  },
  presetName: {
    fontSize: 14,
    flex: 1,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
  },
});
