import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  /** Zero-based current page */
  page: number;
  /** Page size */
  size: number;
  /** Total number of elements */
  totalElements: number;
  onPageChange: (page: number) => void;
  onSizeChange?: (size: number) => void;
  /** Allowed page sizes */
  sizeOptions?: number[];
}

/**
 * Shared pagination controls. Use for all list endpoints per §11.6.
 */
export function Pagination({
  page,
  size,
  totalElements,
  onPageChange,
  onSizeChange,
  sizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const first = totalElements === 0 ? 0 : page * size + 1;
  const last = Math.min((page + 1) * size, totalElements);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Showing <span className="font-medium">{first}</span>–
          <span className="font-medium">{last}</span> of{" "}
          <span className="font-medium">{totalElements}</span>
        </p>
        {onSizeChange && (
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            aria-label="Items per page"
          >
            {sizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
