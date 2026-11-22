import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import { NavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { TableCustomizationProvider } from "./TableCustomizationProvider";
import { useTableCustomization } from "@/contexts/TableCustomizationContext";

describe("TableCustomizationProvider", () => {
  let mockNavCtx: any;

  function createStore() {
    return configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
      },
      preloadedState: {
        orgContext: {
          orgId: "org-test-1",
          branchId: "branch-test-1",
          terminalId: "term-test-1",
          orgName: "Test Org",
          branchName: "Main Branch",
          terminalName: "POS 1",
        },
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    mockNavCtx = {
      adminVisibility: {},
      operatorVisibility: {},
      headerVisibility: {},
      adminLabels: {},
      operatorLabels: {},
      headerLabels: {},
      setAdminVisible: vi.fn(),
      setOperatorVisible: vi.fn(),
      setHeaderVisible: vi.fn(),
      setAdminLabel: vi.fn(),
      setOperatorLabel: vi.fn(),
      setHeaderLabel: vi.fn(),
      resetAdminToDefaults: vi.fn(),
      resetOperatorToDefaults: vi.fn(),
      resetHeaderToDefaults: vi.fn(),
      resetAdminLabels: vi.fn(),
      resetOperatorLabels: vi.fn(),
      resetHeaderLabels: vi.fn(),
      getAdminLabel: vi.fn((_p, d) => d),
      getOperatorLabel: vi.fn((_p, d) => d),
      getHeaderLabel: vi.fn((_p, d) => d),
      getHeaderLogo: vi.fn(() => null),
      setHeaderLogo: vi.fn(),
      darkTheme: "petrol",
      setDarkTheme: vi.fn(),
      isLoading: false,
      isSaving: false,
      needsOrgSelection: false,
    };
  });

  function wrapper({ children }: { children: ReactNode }) {
    const store = createStore();
    return (
      <Provider store={store}>
        <NavVisibilityContext.Provider value={mockNavCtx}>
          <TableCustomizationProvider>{children}</TableCustomizationProvider>
        </NavVisibilityContext.Provider>
      </Provider>
    );
  }

  it("loads defaults for a table when no customization is stored", () => {
    const { result } = renderHook(() => useTableCustomization("items"), { wrapper });

    expect(result.current.columns.length).toBeGreaterThan(0);
    expect(result.current.density).toBe("comfortable");
    expect(result.current.pageSize).toBe(20);
    expect(result.current.showRowNumbers).toBe(true);
    expect(result.current.zebraStriping).toBe(true);
    expect(result.current.getColumnLabel("sku")).toBe("SKU");
  });

  it("customizes column label immediately in cache and pushes to backend", () => {
    const { result } = renderHook(() => useTableCustomization("items"), { wrapper });

    act(() => {
      result.current.setColumnLabel("sku", "Custom SKU Label", true);
    });

    expect(result.current.getColumnLabel("sku")).toBe("Custom SKU Label");
    expect(mockNavCtx.setAdminLabel).toHaveBeenCalledWith(
      "table.items.sku.label",
      "Custom SKU Label"
    );

    // Verifies localStorage has been updated
    const saved = JSON.parse(
      localStorage.getItem("xpos_table_customization_org-test-1") || "{}"
    );
    expect(saved.labels["table.items.sku.label"]).toBe("Custom SKU Label");
  });

  it("toggles column visibility", () => {
    const { result } = renderHook(() => useTableCustomization("items"), { wrapper });

    act(() => {
      result.current.setColumnVisibility("barcode", false);
    });

    expect(result.current.isColumnVisible("barcode")).toBe(false);
    expect(mockNavCtx.setAdminVisible).toHaveBeenCalledWith(
      "table.items.barcode.visible",
      false
    );
  });

  it("updates table density, pageSize, row numbers, and zebra striping", () => {
    const { result } = renderHook(() => useTableCustomization("items"), { wrapper });

    act(() => {
      result.current.setTableDensity("compact");
      result.current.setTablePageSize(50);
      result.current.setShowRowNumbers(false);
      result.current.setZebraStriping(false);
    });

    expect(result.current.density).toBe("compact");
    expect(result.current.densityStyles.th).toContain("py-2");
    expect(result.current.pageSize).toBe(50);
    expect(result.current.showRowNumbers).toBe(false);
    expect(result.current.zebraStriping).toBe(false);
  });

  it("reorders columns and moves column up / down", () => {
    const { result } = renderHook(() => useTableCustomization("items"), { wrapper });

    const initialColumns = result.current.columns;
    const secondCol = initialColumns[1]; // sku
    expect(secondCol.key).toBe("sku");

    // Move sku up -> swaps with name
    act(() => {
      result.current.moveColumnOrder("sku", "up");
    });

    const updatedCols = result.current.columns;
    expect(updatedCols[0].key).toBe("sku");
    expect(updatedCols[1].key).toBe("name");
  });

  it("resets table to defaults", () => {
    const { result } = renderHook(() => useTableCustomization("items"), { wrapper });

    act(() => {
      result.current.setColumnLabel("sku", "Changed SKU", true);
      result.current.setTableDensity("spacious");
    });

    expect(result.current.getColumnLabel("sku")).toBe("Changed SKU");
    expect(result.current.density).toBe("spacious");

    act(() => {
      result.current.resetTableToDefaults();
    });

    expect(result.current.getColumnLabel("sku")).toBe("SKU");
    expect(result.current.density).toBe("comfortable");
  });
});
