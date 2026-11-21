import { useState, useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Info, Loader2, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { ProgressBar } from "./ProgressBar";
import { cn } from "@/utils/cn";
import { recordActionDurationMs } from "@/utils/actionDuration";
import { toSentenceCase } from "@/utils/textCase";

export type ConfirmDialogMaxWidth =
  | "max-w-md"
  | "max-w-lg"
  | "max-w-xl"
  | "max-w-2xl"
  | "max-w-3xl"
  | "max-w-4xl"
  | "max-w-5xl"
  | "max-w-2xl sm:max-w-4xl";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "warning" | "default";
  icon?: ReactNode;
  loading?: boolean;
  /** Panel max width (default max-w-lg). */
  maxWidth?: ConfirmDialogMaxWidth;
  /** Optional second action (e.g. permanent delete next to soft delete). Renders after primary confirm. */
  trailingDangerAction?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

/**
 * Reusable dynamic confirmation dialog for destructive or critical actions (delete, logout, deactivate, etc.).
 * Features:
 * - Contextual icon badge (danger, warning, primary)
 * - Clear title and full readable description (unclipped)
 * - Action/OK button on the far left, Cancel button on the far right
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
  icon,
  loading = false,
  maxWidth = "max-w-lg",
  trailingDangerAction,
}: ConfirmDialogProps) {
  if (!open) return null;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const anyLoading = loading || Boolean(trailingDangerAction?.loading);
  const loadingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (anyLoading) {
      if (loadingStartRef.current === null) {
        loadingStartRef.current = performance.now();
      }
    } else if (loadingStartRef.current !== null) {
      const durationMs = performance.now() - loadingStartRef.current;
      recordActionDurationMs(durationMs);
      loadingStartRef.current = null;
    }
  }, [anyLoading]);

  useEffect(() => {
    if (!open || !anyLoading) {
      setElapsedSeconds(0);
      return;
    }
    const startTime = Date.now();
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [open, anyLoading]);

  const formatElapsed = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}m ${remaining}s`;
  };

  const confirmVariant =
    variant === "danger" ? "danger" : variant === "primary" ? "primary" : "neutral";

  const renderBadgeIcon = () => {
    if (icon) {
      return (
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            variant === "danger"
              ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
              : variant === "warning"
                ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                : "bg-primary-100 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
          )}
        >
          {icon}
        </div>
      );
    }
    if (variant === "danger") {
      return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
          <Trash2 className="h-5 w-5" />
        </div>
      );
    }
    if (variant === "warning") {
      return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400">
        <Info className="h-5 w-5" />
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl transition-all sm:p-6 dark:border-slate-700/80 dark:bg-slate-800",
          maxWidth
        )}
      >
        <div className="flex items-start gap-4">
          {renderBadgeIcon()}
          <div className="min-w-0 flex-1">
            <h3
              id="confirm-dialog-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              {toSentenceCase(title)}
            </h3>
            <div
              id="confirm-dialog-desc"
              className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
            >
              {message}
            </div>
          </div>
        </div>

        {anyLoading && (
          <div className="mt-4 sm:mt-5">
            <ProgressBar
              indeterminate
              size="sm"
              label="Processing request…"
              sublabel={
                elapsedSeconds > 0
                  ? `Please wait (${formatElapsed(elapsedSeconds)})`
                  : "Please wait"
              }
            />
          </div>
        )}

        {/* Footer with action button(s) far left and cancel button far right */}
        <div className="mt-6 flex flex-row flex-nowrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700/60">
          <div className="flex items-center gap-3">
            <Button
              variant={confirmVariant}
              size="md"
              onClick={onConfirm}
              disabled={anyLoading}
              className="shrink-0"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Processing…</span>
                </span>
              ) : (
                toSentenceCase(confirmLabel)
              )}
            </Button>
            {trailingDangerAction ? (
              <Button
                variant="danger"
                size="md"
                onClick={trailingDangerAction.onClick}
                disabled={anyLoading}
                className="shrink-0"
              >
                {trailingDangerAction.loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Processing…</span>
                  </span>
                ) : (
                  toSentenceCase(trailingDangerAction.label)
                )}
              </Button>
            ) : null}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={anyLoading}
            className="shrink-0"
          >
            {toSentenceCase(cancelLabel)}
          </Button>
        </div>
      </div>
    </div>
  );
}
