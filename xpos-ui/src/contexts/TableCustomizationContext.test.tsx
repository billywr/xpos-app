import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  TableCustomizationContext,
  useTableCustomization,
  computeDensityStyles,
  type TableCustomizationContextValue,
  type TableDensity,
} from "./TableCustomizationContext";

describe("TableCustomizationContext & useTableCustomization", () => {
  it("provides built-in safe defaults when used outside of provider", () => {
    const { result } = renderHook(() => useTableCustomization("items"));

    expect(result.current.columns.length).toBeGreaterThan(0);
    expect(result.current.density).toBe("comfortable");
    expect(result.current.showRowNumbers).toBe(true);
    expect(result.current.zebraStriping).toBe(true);
    expect(result.current.isColumnVisible("name")).toBe(true);
    expect(result.current.getColumnLabel("name")).toBe("Name");
    expect(result.current.getColumnAlign("name")).toBe("left");
    expect(result.current.getColumnAlign("buyingPrice")).toBe("right");
  });

  it("computes correct Tailwind density styles for all 3 density settings", () => {
    const compact = computeDensityStyles("compact");
    expect(compact.th).toContain("py-2");
    expect(compact.td).toContain("py-1.5");

    const comfortable = computeDensityStyles("comfortable");
    expect(comfortable.th).toContain("py-3");
    expect(comfortable.td).toContain("py-2");

    const spacious = computeDensityStyles("spacious");
    expect(spacious.th).toContain("py-4");
    expect(spacious.td).toContain("py-3.5");
  });

  it("delegates to context methods when wrapped with TableCustomizationContext.Provider", () => {
    const mockCtx: TableCustomizationContextValue = {
      getTableConfig: vi.fn(() => [
        {
          key: "name",
          label: "Product Name",
          defaultLabel: "Name",
          customLabel: "Product Name",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 1,
          defaultOrder: 1,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "sku",
          label: "SKU",
          defaultLabel: "SKU",
          visible: false,
          defaultVisible: true,
          canHide: true,
          order: 2,
          defaultOrder: 2,
          align: "left" as const,
          sortable: true,
        },
      ]),
      getVisibleColumns: vi.fn(() => [
        {
          key: "name",
          label: "Product Name",
          defaultLabel: "Name",
          customLabel: "Product Name",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 1,
          defaultOrder: 1,
          align: "left" as const,
          sortable: true,
        },
      ]),
      isColumnVisible: vi.fn((_t, col) => col === "name"),
      getColumnLabel: vi.fn((_t, col) => (col === "name" ? "Product Name" : col)),
      getColumnAlign: vi.fn(() => "left" as const),
      getTableDensity: vi.fn(() => "compact" as TableDensity),
      getTablePageSize: vi.fn(() => 50),
      getShowRowNumbers: vi.fn(() => false),
      getZebraStriping: vi.fn(() => true),
      setColumnVisibility: vi.fn(),
      setColumnLabel: vi.fn(),
      setColumnAlign: vi.fn(),
      moveColumnOrder: vi.fn(),
      setColumnOrder: vi.fn(),
      setTableDensity: vi.fn(),
      setTablePageSize: vi.fn(),
      setShowRowNumbers: vi.fn(),
      setZebraStriping: vi.fn(),
      resetTableToDefaults: vi.fn(),
      resetAllTablesToDefaults: vi.fn(),
      isSaving: false,
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <TableCustomizationContext.Provider value={mockCtx}>
        {children}
      </TableCustomizationContext.Provider>
    );

    const { result } = renderHook(() => useTableCustomization("items"), { wrapper });

    expect(result.current.columns).toHaveLength(2);
    expect(result.current.visibleColumns).toHaveLength(1);
    expect(result.current.density).toBe("compact");
    expect(result.current.pageSize).toBe(50);
    expect(result.current.showRowNumbers).toBe(false);
    expect(result.current.zebraStriping).toBe(true);

    // Call mutation helpers
    result.current.setColumnVisibility("sku", true);
    expect(mockCtx.setColumnVisibility).toHaveBeenCalledWith("items", "sku", true);

    result.current.setColumnLabel("name", "Item Title");
    expect(mockCtx.setColumnLabel).toHaveBeenCalledWith("items", "name", "Item Title", undefined);

    result.current.setTableDensity("spacious");
    expect(mockCtx.setTableDensity).toHaveBeenCalledWith("items", "spacious");

    result.current.resetTableToDefaults();
    expect(mockCtx.resetTableToDefaults).toHaveBeenCalledWith("items");
  });
});
