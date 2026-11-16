import { cn } from "@/utils/cn";

export interface TableSkeletonProps {
  rows?: number;
  columns: number;
  columnClassName?: (colIndex: number) => string;
}

export function TableSkeleton({ rows = 8, columns, columnClassName }: TableSkeletonProps) {
  return (
    <>
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

