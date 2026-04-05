import { useMemo, useState } from "react";

export function useTableSearch<T>(rows: T[]) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row as Record<string, unknown>).some((v) => {
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, searchQuery]);

  return { searchQuery, setSearchQuery, filteredRows };
}
