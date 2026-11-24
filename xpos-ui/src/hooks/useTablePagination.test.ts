import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAllStoredTablePageSize } from "@/utils/tablePaginationStorage";
import { useTablePagination } from "./useTablePagination";

describe("useTablePagination", () => {
  beforeEach(() => {
    clearAllStoredTablePageSize();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("initializes with default page and default size", () => {
    const { result } = renderHook(() =>
      useTablePagination({ tableKey: "test-table", defaultPageSize: 15 })
    );

    expect(result.current.page).toBe(0);
    expect(result.current.size).toBe(15);
    expect(result.current.pageSize).toBe(15);
  });

  it("updates page on page change", () => {
    const { result } = renderHook(() =>
      useTablePagination({ tableKey: "test-table", defaultPageSize: 15 })
    );

    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.page).toBe(2);
  });

  it("updates and persists page size and resets page to 0", () => {
    const { result } = renderHook(() =>
      useTablePagination({ tableKey: "test-table", defaultPageSize: 15 })
    );

    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);

    act(() => {
      result.current.onSizeChange(50);
    });

    expect(result.current.size).toBe(50);
    expect(result.current.pageSize).toBe(50);
    expect(result.current.page).toBe(0);

    // Re-mount simulates refresh
    const { result: reloaded } = renderHook(() =>
      useTablePagination({ tableKey: "test-table", defaultPageSize: 15 })
    );
    expect(reloaded.current.size).toBe(50);
  });
});
