import { Alert, Platform } from "react-native";
import { globalToast } from "@/context/ToastContext";

/**
 * Polyfill for Alert.alert on Web.
 * react-native-web exports a dummy `class Alert { static alert() {} }` which does nothing.
 * This polyfill maps single-button alerts to sleek animated Toast notifications
 * and multi-button confirmation dialogs to window.confirm().
 */
if (Platform.OS === "web") {
  Alert.alert = (
    title?: string,
    message?: string,
    buttons?: Array<{
      text?: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>
  ) => {
    if (!buttons || buttons.length <= 1) {
      const lowerTitle = (title ?? "").toLowerCase();
      const lowerMsg = (message ?? "").toLowerCase();

      let type: "success" | "error" | "info" = "info";
      if (
        lowerTitle.includes("success") ||
        lowerTitle.includes("saved") ||
        lowerTitle.includes("reconciled") ||
        lowerTitle.includes("recorded")
      ) {
        type = "success";
      } else if (
        lowerTitle.includes("error") ||
        lowerTitle.includes("failed") ||
        lowerTitle.includes("invalid") ||
        lowerTitle.includes("missing") ||
        lowerMsg.includes("failed") ||
        lowerMsg.includes("error")
      ) {
        type = "error";
      }

      globalToast.show({
        type,
        title: title || undefined,
        message: message || title || "",
      });

      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
      return;
    }

    const cancelBtn = buttons.find((b) => b.style === "cancel");
    const confirmBtn =
      buttons.find((b) => b.style !== "cancel") ?? buttons[buttons.length - 1];

    const text = [title, message].filter(Boolean).join("\n\n");
    const confirmed =
      typeof window !== "undefined" ? window.confirm(text) : true;

    if (confirmed) {
      confirmBtn?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  };
}

