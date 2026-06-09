import { RefreshCw } from "lucide-react";

export interface TableRefreshButtonProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Refetch control for paginated tables and list screens. */
export function TableRefreshButton({
  onRefresh,
  isRefreshing = false,
  className = "",
  "aria-label": ariaLabel = "Refresh table data",
}: TableRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label={ariaLabel}
      title="Refresh"
      className={`shrink-0 rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${className}`}
    >
      <RefreshCw
        className={`h-4 w-4 sm:h-5 sm:w-5 ${isRefreshing ? "animate-spin" : ""}`}
        aria-hidden
      />
    </button>
  );
}
