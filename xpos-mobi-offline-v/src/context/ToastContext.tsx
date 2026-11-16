import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Toast, type ToastType } from "@/components/ui/Toast";
import { haptics } from "@/utils/haptics";

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextType {
  show: (options: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextType>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  hide: () => {},
});

// Global emitter for non-React code (e.g. alertPolyfill)
type ToastListener = (options: ToastOptions) => void;
let globalListener: ToastListener | null = null;

export const globalToast = {
  show: (options: ToastOptions) => {
    if (globalListener) {
      globalListener(options);
    }
  },
  success: (message: string, title?: string) => {
    globalToast.show({ type: "success", title: title ?? "Success", message });
  },
  error: (message: string, title?: string) => {
    globalToast.show({ type: "error", title: title ?? "Error", message });
  },
  info: (message: string, title?: string) => {
    globalToast.show({ type: "info", title: title ?? "Info", message });
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastState, setToastState] = useState<{
    visible: boolean;
    type: ToastType;
    title?: string;
    message: string;
    durationMs: number;
  }>({
    visible: false,
    type: "info",
    title: undefined,
    message: "",
    durationMs: 3200,
  });

  const show = useCallback((options: ToastOptions) => {
    const type = options.type ?? "info";
    if (type === "success") {
      haptics.success();
    } else if (type === "error") {
      haptics.error();
    } else {
      haptics.light();
    }

    setToastState({
      visible: true,
      type,
      title: options.title,
      message: options.message,
      durationMs: options.durationMs ?? 3200,
    });
  }, []);

  const hide = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  const success = useCallback((message: string, title?: string) => {
    show({ type: "success", title: title ?? "Success", message });
  }, [show]);

  const error = useCallback((message: string, title?: string) => {
    show({ type: "error", title: title ?? "Error", message });
  }, [show]);

  const info = useCallback((message: string, title?: string) => {
    show({ type: "info", title: title ?? "Notice", message });
  }, [show]);

  // Connect the global listener
  React.useEffect(() => {
    globalListener = (opts) => {
      show(opts);
    };
    return () => {
      globalListener = null;
    };
  }, [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, hide }}>
      {children}
      <Toast
        visible={toastState.visible}
        type={toastState.type}
        title={toastState.title}
        message={toastState.message}
        durationMs={toastState.durationMs}
        onDismiss={hide}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
