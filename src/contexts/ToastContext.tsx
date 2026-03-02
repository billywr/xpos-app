import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastItem, type ToastVariant } from "@/components/ui/Toast";

const DEFAULT_SUCCESS_DURATION = 5_000;
const DEFAULT_ERROR_DURATION = 7_000;
const EXIT_MS = 300;

interface ToastContextValue {
  success: (message: string, options?: { title?: string; detail?: string; duration?: number }) => void;
  error: (message: string, options?: { title?: string; detail?: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastEntry {
  toast: ToastItem;
  isExiting: boolean;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const exitTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    (
      variant: ToastVariant,
      message: string,
      options?: { title?: string; detail?: string; duration?: number }
    ) => {
      const id = crypto.randomUUID();
      const title = options?.title ?? (variant === "success" ? "Success" : "Error");
      const duration =
        options?.duration ??
        (variant === "success" ? DEFAULT_SUCCESS_DURATION : DEFAULT_ERROR_DURATION);

      const toast: ToastItem = {
        id,
        variant,
        title,
        message,
        detail: options?.detail,
        duration,
      };

      setEntries((prev) => [...prev, { toast, isExiting: false }]);
      return id;
    },
    []
  );

  const success = useCallback(
    (message: string, options?: { title?: string; detail?: string; duration?: number }) => {
      add("success", message, options);
    },
    [add]
  );

  const error = useCallback(
    (message: string, options?: { title?: string; detail?: string; duration?: number }) => {
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
