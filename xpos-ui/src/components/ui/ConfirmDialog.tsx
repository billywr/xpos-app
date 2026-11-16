import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./Button";
import { ProgressBar } from "./ProgressBar";
import { modalOverlay } from "./styles";
import { cn } from "@/utils/cn";


export type ConfirmDialogMaxWidth = "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-4xl";

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
  /** Panel max width (default max-w-md). Use max-w-xl for longer copy. */
  maxWidth?: ConfirmDialogMaxWidth;
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
  maxWidth = "max-w-md",
  trailingDangerAction,
}: ConfirmDialogProps) {
  if (!open) return null;

  const anyLoading =
    loading || Boolean(trailingDangerAction?.loading);

  const confirmVariant =
    variant === "danger" ? "danger" : variant === "primary" ? "primary" : "neutral";

  const isLarge = maxWidth === "max-w-xl" || maxWidth === "max-w-4xl";
  const isExtraLarge = maxWidth === "max-w-4xl";

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
      <div
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800",
          maxWidth,
          isExtraLarge
            ? "p-9 sm:p-12"
            : isLarge
              ? "p-6 sm:p-8"
              : maxWidth === "max-w-lg"
                ? "p-5 sm:p-7"
                : "p-4 sm:p-6"
        )}
      >
        <h3
          id="confirm-dialog-title"
          className={cn(
            "font-semibold text-slate-900 dark:text-white",
            isExtraLarge
              ? "text-xl sm:text-2xl"
              : isLarge
                ? "text-lg sm:text-xl"
                : "text-base sm:text-lg"
          )}
        >
          {title}
        </h3>
        <p
          id="confirm-dialog-desc"
          className={cn(
            "text-slate-600 dark:text-slate-300",
            isExtraLarge
              ? "mt-4 text-lg leading-relaxed sm:mt-5 sm:text-xl"
              : isLarge
                ? "mt-3 text-base leading-relaxed sm:text-lg"
                : "mt-2 text-sm sm:text-base"
          )}
        >
          {message}
        </p>

        {anyLoading && (
          <div className="mt-4 sm:mt-5">
            <ProgressBar
              indeterminate
              size="sm"
              label="Processing request…"
              sublabel="Please wait"
            />
          </div>
        )}

        <div
          className={cn(
            "flex flex-wrap justify-end gap-2 sm:gap-3",
            isExtraLarge ? "mt-9 sm:mt-12" : isLarge ? "mt-6 sm:mt-8" : "mt-4 sm:mt-6"
          )}
        >
          <Button variant="secondary" size="md" onClick={onClose} disabled={anyLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            size="md"
            onClick={onConfirm}
            disabled={anyLoading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Processing…</span>
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
          {trailingDangerAction ? (
            <Button
              variant="danger"
              size="md"
              onClick={trailingDangerAction.onClick}
              disabled={anyLoading}
            >
              {trailingDangerAction.loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Processing…</span>
                </span>
              ) : (
                trailingDangerAction.label
              )}
            </Button>
          ) : null}
        </div>
      </div>

    </div>
  );
}
