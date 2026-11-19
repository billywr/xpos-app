import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** When true, subtitle is collapsed until the user hovers the title row (icon + text). */
  subtitleRevealOnTitleHover?: boolean;
  /** Optional icon to show next to title */
  icon?: React.ElementType;
  /** Fallback when browser history is empty (e.g. direct link). */
  fallbackTo?: string;
  /** Extra class for the header container */
  className?: string;
  /** Skip default bottom margin (when used inside a custom flex layout) */
  noMargin?: boolean;
  /** Content below subtitle (e.g. filters, actions) */
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  icon: Icon,
  fallbackTo,
  className = "",
  noMargin = false,
  children,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (fallbackTo && window.history.length <= 1) {
      navigate(fallbackTo);
      return;
    }
    navigate(-1);
  };

  const marginClass = noMargin ? "" : "mb-4 sm:mb-6";
  return (
    <header className={`flex items-start gap-2 ${marginClass} ${className}`}>
      <button
        type="button"
        onClick={handleBack}
        className="-ml-1 mt-0.5 flex shrink-0 rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
        aria-label="Go back"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
          {Icon && <Icon className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />}
          {title}
        </h1>
        {children}
      </div>
    </header>
  );
}
