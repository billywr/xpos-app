import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Camera, Barcode } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { haptics } from "@/utils/haptics";

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
}) => {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState("");
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    haptics.success();
    onScan(data);
    onClose();
    setTimeout(() => setScanned(false), 1000);
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    haptics.light();
    onScan(manualCode.trim());
    setManualCode("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.headerLeft}>
            <Barcode size={22} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              Scan Barcode
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Camera View / Fallback */}
        <View style={styles.cameraContainer}>
          {Platform.OS !== "web" && permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "qr",
                  "ean13",
                  "ean8",
                  "code128",
                  "code39",
                  "upc_a",
                  "upc_e",
                ],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            >
              <View style={styles.overlay}>
                <View style={styles.targetFrame} />
                <Text style={styles.overlayText}>
                  Point camera at product barcode
                </Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionBox}>
              <Camera size={48} color={colors.textSubtle} />
              <Text style={[styles.permTitle, { color: colors.text }]}>
                Camera Access
              </Text>
              <Text style={[styles.permDesc, { color: colors.textMuted }]}>
                {Platform.OS === "web"
                  ? "Camera scanning is available on mobile devices. Use manual input below."
                  : "Allow camera access to scan item barcodes instantly."}
              </Text>
              {Platform.OS !== "web" && !permission?.granted ? (
                <Button
                  title="Grant Permission"
                  onPress={requestPermission}
                  style={styles.permBtn}
                />
              ) : null}
            </View>
          )}
        </View>

        {/* Manual Barcode Input Fallback */}
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.footerLabel, { color: colors.textMuted }]}>
            Or enter barcode manually:
          </Text>
          <View style={styles.manualRow}>
            <Input
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="e.g. 6161100000001"
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <Button
              title="Search"
              onPress={handleManualSubmit}
              disabled={!manualCode.trim()}
              style={{ marginLeft: 8 }}
            />
          </View>
        </View>
      </View>
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
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#000000",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  targetFrame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: "#10b981",
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  overlayText: {
    color: "#ffffff",
    marginTop: 16,
    fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permissionBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  permTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 16,
  },
  permDesc: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  permBtn: {
    marginTop: 16,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  footerLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
