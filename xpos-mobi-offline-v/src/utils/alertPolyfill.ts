import { Alert, Platform } from "react-native";
import { globalToast } from "@/context/ToastContext";

/**
 * Universal Alert interceptor:
 * Converts single-button / notification Alert.alert calls across Android, iOS, and Web
 * into sleek, non-blocking animated Toast notifications.
 * Preserves multi-button confirmation dialogs (e.g. [Cancel, Delete]).
 */
const originalAlert = Alert.alert;

Alert.alert = (
  title?: string,
  message?: string,
  buttons?: Array<{
    text?: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }>
) => {
  // If there are no buttons or only 1 button (e.g. "OK"), render as Toast
  if (!buttons || buttons.length <= 1) {
    const lowerTitle = (title ?? "").toLowerCase();
    const lowerMsg = (message ?? "").toLowerCase();

    let type: "success" | "error" | "info" = "info";
    if (
      lowerTitle.includes("success") ||
      lowerTitle.includes("saved") ||
      lowerTitle.includes("reconciled") ||
      lowerTitle.includes("recorded") ||
      lowerMsg.includes("success") ||
      lowerMsg.includes("saved")
    ) {
      type = "success";
    } else if (
      lowerTitle.includes("error") ||
      lowerTitle.includes("failed") ||
      lowerTitle.includes("invalid") ||
      lowerTitle.includes("missing") ||
      lowerMsg.includes("failed") ||
      lowerMsg.includes("error") ||
      lowerMsg.includes("canceled") ||
      lowerMsg.includes("timed out")
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

  // Multi-button confirmation dialogs
  if (Platform.OS === "web") {
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
    return;
  }

  // On native platforms, let native Alert handle multi-button confirmations
  if (typeof originalAlert === "function") {
    originalAlert(title ?? "", message, buttons);
  }
};


