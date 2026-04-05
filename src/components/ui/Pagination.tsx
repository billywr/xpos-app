import { ChevronLeft, ChevronRight } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

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
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <p className="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
          <span className="font-medium">{first}</span>–
          <span className="font-medium">{last}</span> of{" "}
          <span className="font-medium">{totalElements}</span>
        </p>
        {onSizeChange && (
          <SearchableSelect
            aria-label="Items per page"
            options={sizeOptions.map((n) => ({
              value: String(n),
              label: `${n} / pg`,
            }))}
            value={String(size)}
            onChange={(v) => onSizeChange(Number(v))}
            compact
            className="hidden w-auto min-w-[7rem] sm:block sm:min-w-[9rem]"
          />
        )}
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <span className="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
          {page + 1}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 sm:p-2 dark:text-slate-400 dark:hover:bg-slate-700 dark:disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 sm:p-2 dark:text-slate-400 dark:hover:bg-slate-700 dark:disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>
    </div>
  );
}
