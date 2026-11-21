import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Toast, type ToastItem, type ToastVariant } from "@/components/ui/Toast";
import { generateUuid } from "@/utils/uuid";
import { getLastActionDuration, clearLastActionDuration } from "@/utils/actionDuration";
import { isToastTimeVisible } from "@/config/toastSettings";

const DEFAULT_SUCCESS_DURATION = 5_000;
const DEFAULT_ERROR_DURATION = 7_000;
const EXIT_MS = 300;

export interface ToastOptions {
  title?: string;
  detail?: string;
  duration?: number;
  action?: { label: string; href: string };
  timeTaken?: string;
}

interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastEntry {
  toast: ToastItem;
  isExiting: boolean;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const [, setShowTime] = useState<boolean>(() => isToastTimeVisible());
  const exitTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const handleVisibilityChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ visible: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.visible === "boolean") {
        setShowTime(customEvent.detail.visible);
      } else {
        setShowTime(isToastTimeVisible());
      }
    };
    window.addEventListener("toast-time-visibility-changed", handleVisibilityChange);
    window.addEventListener("storage", handleVisibilityChange);
    return () => {
      window.removeEventListener("toast-time-visibility-changed", handleVisibilityChange);
      window.removeEventListener("storage", handleVisibilityChange);
    };
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.toast.id === id ? { ...e, isExiting: true } : e
      );
      return next;
    });

    const t = setTimeout(() => {
      exitTimeoutsRef.current.delete(id);
      setEntries((prev) => prev.filter((e) => e.toast.id !== id));
    }, EXIT_MS);
    exitTimeoutsRef.current.set(id, t);
  }, []);

  const add = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      // Clear any pending exit timeouts
      exitTimeoutsRef.current.forEach((t) => clearTimeout(t));
      exitTimeoutsRef.current.clear();

      const id = generateUuid();
      const title = options?.title ?? (variant === "success" ? "Success" : "Error");
      const duration =
        options?.duration ??
        (variant === "success" ? DEFAULT_SUCCESS_DURATION : DEFAULT_ERROR_DURATION);

      let timeTaken = options?.timeTaken;
      if (variant === "success") {
        if (!timeTaken) {
          const lastDuration = getLastActionDuration();
          if (lastDuration) {
            timeTaken = lastDuration;
          }
        }
      } else {
        // Clear any recorded action duration so failure doesn't leak duration into later toasts
        clearLastActionDuration();
      }

      const isTimeVisible = isToastTimeVisible();
      if (!isTimeVisible) {
        timeTaken = undefined;
      }

      let finalMessage = message;
      if (!isTimeVisible) {
        finalMessage = finalMessage.replace(/\s+in\s+\d+(\.\d+)?(s|ms)\b/gi, "");
      } else if (variant === "success" && timeTaken) {
        const alreadyHasDuration = /\bin\s+\d+(\.\d+)?(s|ms)\b/i.test(finalMessage);
        if (!alreadyHasDuration) {
          if (finalMessage.includes(".")) {
            finalMessage = finalMessage.replace(/^([^.]+)/, `$1 in ${timeTaken}`);
          } else {
            finalMessage = `${finalMessage} in ${timeTaken}`;
          }
        }
      }

      const toast: ToastItem = {
        id,
        variant,
        title,
        message: finalMessage,
        detail: options?.detail,
        action: options?.action,
        duration,
        timeTaken,
      };

      // Close previous toast before displaying current (no stacking)
      setEntries([{ toast, isExiting: false }]);
      return id;
    },
    []
  );

  const success = useCallback(
    (message: string, options?: ToastOptions) => {
      add("success", message, options);
    },
    [add]
  );

  const error = useCallback(
    (message: string, options?: ToastOptions) => {
      add("error", message, options);
    },
    [add]
  );

  const value: ToastContextValue = { success, error };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-4 top-4 z-[100] flex max-h-[100vh] w-full max-w-sm flex-col gap-3 overflow-hidden p-0"
        aria-label="Notifications"
      >
        {entries.map(({ toast, isExiting }) => (
          <Toast
            key={toast.id}
            toast={toast}
            isExiting={isExiting}
            onDismiss={() => remove(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
