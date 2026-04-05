import type { ReactNode } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "default";
  loading?: boolean;
  /** Optional second action (e.g. permanent delete next to soft delete). Renders after primary confirm. */
  trailingDangerAction?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

/**
 * Confirmation dialog for destructive or critical actions (delete, deactivate, etc.).
 * Per §11.3: always show before performing the action.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  trailingDangerAction,
}: ConfirmDialogProps) {
  if (!open) return null;

  const anyLoading =
    loading || Boolean(trailingDangerAction?.loading);

  const confirmButtonClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700"
      : variant === "primary"
        ? "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600"
        : "bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500 dark:bg-slate-600 dark:hover:bg-slate-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/60"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-slate-700 dark:bg-slate-800">
        <h3
          id="confirm-dialog-title"
          className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white"
        >
          {title}
        </h3>
        <p
          id="confirm-dialog-desc"
          className="mt-2 text-sm text-slate-600 sm:text-base dark:text-slate-300"
        >
          {message}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2 sm:mt-6 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={anyLoading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={anyLoading}
            className={`rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-slate-800 ${confirmButtonClass}`}
          >
            {loading ? "…" : confirmLabel}
          </button>
          {trailingDangerAction ? (
            <button
              type="button"
              onClick={trailingDangerAction.onClick}
              disabled={anyLoading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-offset-slate-800"
            >
              {trailingDangerAction.loading ? "…" : trailingDangerAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
