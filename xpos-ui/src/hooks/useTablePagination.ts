import { useCallback, useState } from "react";
import {
  getStoredTablePageSize,
  setStoredTablePageSize,
} from "@/utils/tablePaginationStorage";

export interface UseTablePaginationOptions {
  tableKey?: string;
  defaultPageSize?: number;
  sizeOptions?: number[];
  initialPage?: number;
}

export function useTablePagination({
  tableKey,
  defaultPageSize = 25,
  sizeOptions,
  initialPage = 0,
}: UseTablePaginationOptions = {}) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(() =>
    getStoredTablePageSize(tableKey, defaultPageSize, sizeOptions)
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSizeChange = useCallback(
    (newSize: number) => {
      setPageSizeState(newSize);
      setStoredTablePageSize(newSize, tableKey);
      setPage(0);
    },
    [tableKey]
  );

  return {
    page,
    setPage: handlePageChange,
    pageSize,
    setPageSize: handleSizeChange,
    size: pageSize,
    setSize: handleSizeChange,
    handlePageChange,
    handleSizeChange,
    onPageChange: handlePageChange,
    onSizeChange: handleSizeChange,
  };
}
