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
  maxWidth?: "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-2xl";
  className?: string;
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
      <div className={cn(modalPanel, maxWidth, className)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
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
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
