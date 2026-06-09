import type { ReactNode } from "react";
import { Button } from "./Button";
import { modalOverlay } from "./styles";

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

  const confirmVariant =
    variant === "danger" ? "danger" : variant === "primary" ? "primary" : "neutral";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        className={modalOverlay}
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
          <Button variant="secondary" size="md" onClick={onClose} disabled={anyLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            size="md"
            onClick={onConfirm}
            disabled={anyLoading}
          >
            {loading ? "…" : confirmLabel}
          </Button>
          {trailingDangerAction ? (
            <Button
              variant="danger"
              size="md"
              onClick={trailingDangerAction.onClick}
              disabled={anyLoading}
            >
              {trailingDangerAction.loading ? "…" : trailingDangerAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
