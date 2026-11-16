import { Search } from "lucide-react";
import { TableRefreshButton } from "./TableRefreshButton";

export interface TableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function TableSearchInput({
  value,
  onChange,
  placeholder = "Search\u2026",
  className = "",
  onRefresh,
  isRefreshing = false,
}: TableSearchInputProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 sm:max-w-xs"
      />
      {onRefresh && (
        <TableRefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
      )}
    </div>
  );
}
