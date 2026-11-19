import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface TableSkeletonProps {
  rows?: number;
  columns: number;
  columnClassName?: (colIndex: number) => string;
  /** When true, renders an inline banner with a spinner indicating live fetching. */
  withSpinner?: boolean;
  /** Custom label when withSpinner is true. Defaults to "Loading records…". */
  spinnerText?: string;
}

export function TableSkeleton({
  rows = 8,
  columns,
  columnClassName,
  withSpinner = false,
  spinnerText = "Loading records…",
}: TableSkeletonProps) {
  return (
    <>
      {withSpinner && (
        <tr>
          <td
            colSpan={columns}
            className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-medium text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-400"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-500 dark:text-primary-400" />
              <span>{spinnerText}</span>
            </div>
          </td>
        </tr>
      )}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={`sk-${rowIdx}`} className="animate-pulse">
          {Array.from({ length: columns }).map((__, colIdx) => (
            <td
              key={`sk-${rowIdx}-${colIdx}`}
              className={cn("px-4 py-3 sm:px-6 sm:py-3.5", columnClassName?.(colIdx))}
            >
              <div className="h-3.5 w-full max-w-[160px] rounded bg-slate-200/80 dark:bg-slate-700/70" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

