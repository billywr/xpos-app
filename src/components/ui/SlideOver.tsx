import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional max width class (default max-w-lg) */
  maxWidth?: "max-w-md" | "max-w-lg" | "max-w-xl";
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
  maxWidth = "max-w-lg",
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
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 dark:bg-slate-950/60"
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col ${maxWidth} border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 id="slideover-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </>
  );
}
