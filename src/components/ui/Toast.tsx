import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error";

export interface ToastAction {
  label: string;
  href: string;
}

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message: string;
  detail?: string;
  action?: ToastAction;
  duration?: number;
}

export interface ToastProps {
  toast: ToastItem;
  isExiting: boolean;
  onDismiss: () => void;
}

export function Toast({ toast, isExiting, onDismiss }: ToastProps) {
  const isSuccess = toast.variant === "success";
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const t = setTimeout(onDismiss, toast.duration);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [toast.duration, onDismiss]);

  const baseClass =
    "pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-lg border shadow-lg transition-all duration-300 ease-out";
  const exitClass = isExiting
    ? "translate-x-full opacity-0"
    : entered
      ? "translate-x-0 opacity-100"
      : "translate-x-full opacity-0";
  const variantClass = isSuccess
    ? "border-emerald-200 bg-white dark:border-emerald-800 dark:bg-slate-800"
    : "border-red-200 bg-white dark:border-red-900/50 dark:bg-slate-800";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      aria-live={isSuccess ? "polite" : "assertive"}
      aria-atomic="true"
      className={`${baseClass} ${exitClass} ${variantClass}`}
    >
      <div
        className={
          isSuccess
            ? "flex shrink-0 items-center p-3 bg-emerald-50 dark:bg-emerald-900/20"
            : "flex shrink-0 items-center p-3 bg-red-50 dark:bg-red-900/20"
        }
      >
        {isSuccess ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{toast.title}</p>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{toast.message}</p>
        {toast.detail && (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{toast.detail}</p>
        )}
        {toast.action && (
          <Link
            to={toast.action.href}
            className="mt-2 inline-block text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {toast.action.label} →
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-start p-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
