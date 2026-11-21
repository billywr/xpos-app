import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { IconButton } from "./IconButton";
import { modalOverlay, modalPanel } from "./styles";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max width class (default max-w-lg) */
  maxWidth?:
    | "max-w-md"
    | "max-w-lg"
    | "max-w-xl"
    | "max-w-2xl"
    | "max-w-3xl"
    | "max-w-4xl"
    | "max-w-5xl";
  /** Cap height and let body content manage internal scroll (e.g. long tables). */
  scrollable?: boolean;
  /** Max height when scrollable (default max-h-[min(90vh,48rem)]). */
  scrollMaxHeight?: string;
  /** Shows an indeterminate progress bar along the header when an operation is pending */
  loading?: boolean;
  className?: string;
}


export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard footer container for modal/popup action buttons.
 * Enforces system-wide UX standard:
 * - Other/action button far left, Cancel button far right
 * - Guaranteed shrink-0 / flex-nowrap to prevent awkward wrapping
 */
export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-row flex-nowrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Centered modal dialog shell. Use for info/breakdown dialogs;
 * destructive flows should use ConfirmDialog.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
  scrollable = false,
  scrollMaxHeight = "max-h-[min(90vh,48rem)]",
  loading = false,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div className={modalOverlay} aria-hidden onClick={onClose} />
      <div
        className={cn(
          modalPanel,
          "overflow-hidden",
          maxWidth,
          scrollable && cn("flex flex-col overflow-hidden", scrollMaxHeight),
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          {title ? (
            <h3
              id="modal-title"
              className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white"
            >
              {title}
            </h3>
          ) : (
            <span />
          )}
          <IconButton onClick={onClose} aria-label="Close" className="ml-auto">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        {loading && (
          <div className="relative h-1 w-full overflow-hidden bg-slate-100 dark:bg-slate-700/80">
            <div className="animate-indeterminate-1 rounded-full bg-primary-600 dark:bg-primary-500" />
            <div className="animate-indeterminate-2 rounded-full bg-primary-400 dark:bg-primary-400" />
          </div>
        )}
        <div
          className={cn(
            "p-5",
            scrollable && "flex min-h-0 flex-1 flex-col overflow-hidden"
          )}

        >
          {children}
        </div>
      </div>
    </div>
  );
}
