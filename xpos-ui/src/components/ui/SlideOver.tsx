import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { IconButton } from "./IconButton";
import { modalOverlay } from "./styles";

export interface SlideOverFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard footer container for slide-over sheet action buttons.
 * Renders a 2-column grid so Cancel and Add/Save occupy 50% width each side by side.
 */
export function SlideOverFooter({ children, className }: SlideOverFooterProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 pt-4", className)}>
      {children}
    </div>
  );
}

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional max width class (default w-full sm:max-w-xl md:w-1/2 md:max-w-[50vw] md:min-w-[480px]) */
  maxWidth?: string;
  /** Optional action element rendered in the header next to close button */
  headerAction?: ReactNode;
}

/**
 * Slide-over panel from the right for create/edit forms.
 * Use for all data capture and editing per §11.2.
 */
export function SlideOver({
  open,
  onClose,
  title,
  children,
  maxWidth = "w-full sm:max-w-xl md:w-1/2 md:max-w-[50vw] md:min-w-[480px]",
  headerAction,
}: SlideOverProps) {
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
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slideover-title"
    >
      <div
        className={modalOverlay}
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-10 flex w-full flex-col ${maxWidth} border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-700">
          <h2 id="slideover-title" className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerAction}
            <IconButton variant="bordered" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
