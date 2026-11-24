import { ChevronLeft, ChevronRight } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { setStoredTablePageSize } from "@/utils/tablePaginationStorage";
import { IconButton } from "./IconButton";
import { TableRefreshButton } from "./TableRefreshButton";

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
  /** Position hint — "top" uses border-bottom, "bottom" (default) uses border-top */
  position?: "top" | "bottom";
  /** Storage key to persist selected page size for this table and globally */
  storageKey?: string;
  /** Refetch table data from the server */
  onRefresh?: () => void;
  isRefreshing?: boolean;
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
  position = "bottom",
  storageKey,
  onRefresh,
  isRefreshing = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const first = totalElements === 0 ? 0 : page * size + 1;
  const last = Math.min((page + 1) * size, totalElements);

  const borderClass =
    position === "top"
      ? "border-b border-slate-200 dark:border-slate-700"
      : "border-t border-slate-200 dark:border-slate-700";

  return (
    <div className={`flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3 dark:bg-slate-800 ${borderClass}`}>
      <div className="flex items-center gap-2 sm:gap-4">
        <p className="whitespace-nowrap text-sm font-semibold text-slate-700 sm:text-base dark:text-slate-300">
          <span className="font-bold">{first}</span>–
          <span className="font-bold">{last}</span> of{" "}
          <span className="font-bold">{totalElements}</span>
        </p>
        {onSizeChange && (
          <SearchableSelect
            aria-label="Items per page"
            options={sizeOptions.map((n) => ({
              value: String(n),
              label: `${n} / pg`,
            }))}
            value={String(size)}
            onChange={(v) => {
              const newSize = Number(v);
              setStoredTablePageSize(newSize, storageKey);
              onSizeChange(newSize);
            }}
            compact
            className="w-auto min-w-[5.5rem] text-sm font-semibold sm:min-w-[7rem] sm:text-base"
          />
        )}
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        {onRefresh && (
          <TableRefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
        )}
        <span className="whitespace-nowrap text-sm font-semibold text-slate-700 sm:text-base dark:text-slate-300">
          <span className="font-bold">{page + 1}</span>/
          <span className="font-bold">{totalPages}</span>
        </span>
        <IconButton
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </IconButton>
        <IconButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </IconButton>
      </div>
    </div>
  );
}
