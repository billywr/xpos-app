export type SortDirection = "asc" | "desc";

export interface TableSortState {
  column: string | null;
  direction: SortDirection;
}

export type SortValueGetter<T> = (row: T, column: string) => unknown;

function isNullishSortValue(value: unknown): boolean {
  return value == null || value === "";
}

function toSortableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    const dateMs = Date.parse(trimmed);
    if (Number.isFinite(dateMs)) {
      return dateMs;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }
  return null;
}

function compareUnknownValues(a: unknown, b: unknown): number {
  const aNull = isNullishSortValue(a);
  const bNull = isNullishSortValue(b);
  if (aNull && bNull) {
    return 0;
  }
  if (aNull) {
    return 1;
  }
  if (bNull) {
    return -1;
  }

  const aNum = toSortableNumber(a);
  const bNum = toSortableNumber(b);
  if (aNum != null && bNum != null) {
    return aNum - bNum;
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return Number(Boolean(a)) - Number(Boolean(b));
  }

  return String(a).localeCompare(String(b), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortTableRows<T>(
  rows: T[],
  sort: TableSortState,
  getSortValue: SortValueGetter<T>
): T[] {
  if (!sort.column) {
    return rows;
  }
  const column = sort.column;
  const direction = sort.direction;
  const indexed = rows.map((row, index) => ({
    row,
    index,
    value: getSortValue(row, column),
  }));

  indexed.sort((a, b) => {
    const cmp = compareUnknownValues(a.value, b.value);
    if (cmp !== 0) {
      return direction === "asc" ? cmp : -cmp;
    }
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.row);
}
