import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDirection } from "@/utils/tableSort";
import { toSentenceCase } from "@/utils/textCase";

export interface SortableTableHeadProps {
  columnKey: string;
  label: React.ReactNode;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (columnKey: string) => void;
  sortable?: boolean;
  /** Right: icon sits left of label so data can align with the label's trailing edge. */
  align?: "left" | "right";
  className?: string;
  title?: string;
}

export function SortableTableHead({
  columnKey,
  label,
  sortColumn,
  sortDirection,
  onSort,
  sortable = true,
  align = "left",
  className = "",
  title,
}: SortableTableHeadProps) {
  const displayLabel = typeof label === "string" ? toSentenceCase(label) : label;

  if (!sortable) {
    return (
      <th
        scope="col"
        className={className}
        aria-sort="none"
      >
        {displayLabel}
      </th>
    );
  }

  const isActive = sortColumn === columnKey;
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? sortDirection === "asc"
      ? "ascending"
      : "descending"
    : "none";

  const Icon = isActive
    ? sortDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  const buttonAlign =
    align === "right"
      ? "justify-end text-right"
      : "justify-start text-left";

  const iconClass = `h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${
    isActive
      ? "text-primary-600 dark:text-primary-400"
      : "text-slate-400 opacity-70 group-hover:opacity-100 dark:text-slate-500"
  }`;

  return (
    <th scope="col" className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        title={title ?? `Sort by ${typeof displayLabel === "string" ? displayLabel : columnKey}`}
        className={`group inline-flex w-full min-w-0 items-center gap-1.5 font-inherit tracking-normal text-inherit transition-colors hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:hover:text-primary-300 dark:focus-visible:ring-offset-slate-800 ${buttonAlign}`}
      >
        {align === "right" ? (
          <>
            <Icon className={iconClass} aria-hidden />
            <span className="min-w-0 truncate">{displayLabel}</span>
          </>
        ) : (
          <>
            <span className="min-w-0 truncate">{displayLabel}</span>
            <Icon className={iconClass} aria-hidden />
          </>
        )}
      </button>
    </th>
  );
}
