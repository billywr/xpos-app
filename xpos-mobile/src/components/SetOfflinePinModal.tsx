import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { X, Lock, CheckCircle2, Trash2, KeyRound } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { useToast } from "@/context/ToastContext";
import { storage } from "@/utils/storage";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AnimatedModalBackdrop } from "@/components/ui/AnimatedModalBackdrop";
import { haptics } from "@/utils/haptics";

interface SetOfflinePinModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SetOfflinePinModal: React.FC<SetOfflinePinModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const { username, token, hasOfflinePin, refreshOfflinePinStatus } = useAuth();
  const { orgId, orgName, branchId, branchName, terminalId, terminalName } = useOrg();
  const toast = useToast();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<"enter" | "confirm">("enter");

  const pinInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin("");
      setConfirmPin("");
      setErrorMsg("");
      setStep("enter");
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 250);
    }
  }, [visible]);

  const handlePinChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    setErrorMsg("");

    if (step === "enter") {
      setPin(clean);
      if (clean.length === 4) {
        haptics.selection();
        setStep("confirm");
      }
    } else {
      setConfirmPin(clean);
    }
  };

  const handleSavePin = async () => {
    if (pin.length !== 4) {
      setErrorMsg("PIN must be exactly 4 digits");
      haptics.error();
      return;
    }
    if (confirmPin !== pin) {
      setErrorMsg("PINs do not match. Please verify.");
      haptics.error();
      return;
    }

    setIsSaving(true);
    try {
      await storage.setOfflinePin(pin, {
        username: username || "Operator",
        orgId: orgId || null,
        orgName: orgName || null,
        branchId: branchId || null,
        branchName: branchName || null,
        terminalId: terminalId || null,
        terminalName: terminalName || null,
        lastToken: token,
        savedAt: new Date().toISOString(),
      });
      await refreshOfflinePinStatus();
      haptics.success();
      toast.success("Offline 4-digit PIN configured successfully!", "PIN Saved");
      onClose();
    } catch (e: any) {
      haptics.error();
      setErrorMsg(e?.message ?? "Failed to save offline PIN");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePin = async () => {
    haptics.warning();
    try {
      await storage.clearOfflinePin();
      await refreshOfflinePinStatus();
      toast.info("Offline PIN removed.", "PIN Removed");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove PIN", "Error");
    }
  };

  const currentDisplayPin = step === "enter" ? pin : confirmPin;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <AnimatedModalBackdrop onPressBackdrop={onClose} style={styles.backdrop}>
        <View style={styles.centeredWrapper}>
          <Card
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerLeft}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                  <KeyRound size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {hasOfflinePin ? "Update Offline PIN" : "Set Offline PIN"}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                    Access XPOS when internet is offline
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Content Body */}
            <View style={styles.body}>
              <Text style={[styles.instruction, { color: colors.text }]}>
                {step === "enter" ? "Enter a 4-digit PIN" : "Confirm your 4-digit PIN"}
              </Text>
              <Text style={[styles.subInstruction, { color: colors.textSubtle }]}>
                {step === "enter"
                  ? "This PIN lets you sign in locally without internet connectivity."
                  : "Re-enter the 4 digits to confirm."}
              </Text>

              {/* 4-Digit Display Indicator Dots */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => pinInputRef.current?.focus()}
                style={styles.pinCirclesRow}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = currentDisplayPin.length > idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.pinCircle,
                        {
                          borderColor: isFilled ? colors.primary : colors.border,
                          backgroundColor: isFilled
                            ? colors.primary
                            : isDark
                            ? "rgba(255,255,255,0.06)"
                            : "#f1f5f9",
                        },
                      ]}
                    >
                      {isFilled ? (
                        <View style={styles.pinInnerDot} />
                      ) : null}
                    </View>
                  );
                })}
              </TouchableOpacity>

              {/* Hidden Native Numeric Input */}
              <TextInput
                ref={pinInputRef}
                value={currentDisplayPin}
                onChangeText={handlePinChange}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry={false}
                style={styles.hiddenInput}
                autoFocus={true}
              />

              {errorMsg ? (
                <View
                  style={[
                    styles.errorBox,
                    { backgroundColor: colors.dangerLight, borderColor: colors.danger },
                  ]}
                >
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {errorMsg}
                  </Text>
                </View>
              ) : null}

              {/* Step Navigation Tabs if user entered first step */}
              {step === "confirm" ? (
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setStep("enter");
                    setConfirmPin("");
                  }}
                  style={styles.backStepBtn}
                >
                  <Text style={[styles.backStepText, { color: colors.primary }]}>
                    ← Re-enter first PIN
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Actions */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {hasOfflinePin ? (
                <Button
                  title="Remove PIN"
                  variant="outline"
                  size="md"
                  icon={<Trash2 size={15} color={colors.danger} />}
                  onPress={handleRemovePin}
                  style={{ borderColor: colors.danger }}
                />
              ) : null}
              <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="md"
                  onPress={onClose}
                />
                <Button
                  title="Save PIN"
                  variant="primary"
                  size="md"
                  loading={isSaving}
                  disabled={pin.length !== 4 || confirmPin.length !== 4}
                  icon={<CheckCircle2 size={16} color="#ffffff" />}
                  onPress={handleSavePin}
                />
              </View>
            </View>
          </Card>
        </View>
      </AnimatedModalBackdrop>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centeredWrapper: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
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
  body: {
    padding: 24,
    alignItems: "center",
  },
  instruction: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  subInstruction: {
    fontSize: 13,
    marginBottom: 24,
    textAlign: "center",
  },
  pinCirclesRow: {
    flexDirection: "row",
    gap: 18,
    marginVertical: 12,
    justifyContent: "center",
  },
  pinCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pinInnerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ffffff",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
  },
  backStepBtn: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backStepText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 10,
  },
});
