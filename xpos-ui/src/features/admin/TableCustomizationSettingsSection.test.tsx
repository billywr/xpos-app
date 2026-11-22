import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TableCustomizationContext,
  type TableCustomizationContextValue,
  type TableDensity,
} from "@/contexts/TableCustomizationContext";
import { TableCustomizationSettingsSection } from "./TableCustomizationSettingsSection";

describe("TableCustomizationSettingsSection", () => {
  let mockContext: TableCustomizationContextValue;

  beforeEach(() => {
    mockContext = {
      getTableConfig: vi.fn((_tableId: string) => [
        {
          key: "name",
          label: "Name",
          defaultLabel: "Name",
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
          visible: true,
          defaultVisible: true,
          canHide: true,
          order: 2,
          defaultOrder: 2,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "buyingPrice",
          label: "Buying (KSH)",
          defaultLabel: "Buying (KSH)",
          visible: true,
          defaultVisible: true,
          canHide: true,
          order: 3,
          defaultOrder: 3,
          align: "right" as const,
          sortable: true,
        },
      ]),
      getVisibleColumns: vi.fn((_tableId: string) => [
        {
          key: "name",
          label: "Name",
          defaultLabel: "Name",
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
          visible: true,
          defaultVisible: true,
          canHide: true,
          order: 2,
          defaultOrder: 2,
          align: "left" as const,
          sortable: true,
        },
      ]),
      isColumnVisible: vi.fn(() => true),
      getColumnLabel: vi.fn((_t, col) => col),
      getColumnAlign: vi.fn((_t, col) => (col === "buyingPrice" ? ("right" as const) : ("left" as const))),
      getTableDensity: vi.fn(() => "comfortable" as TableDensity),
      getTablePageSize: vi.fn(() => 20),
      getShowRowNumbers: vi.fn(() => true),
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
  });

  function renderSection() {
    return render(
      <TableCustomizationContext.Provider value={mockContext}>
        <TableCustomizationSettingsSection />
      </TableCustomizationContext.Provider>
    );
  }

  it("renders section title and category filters", () => {
    renderSection();

    expect(screen.getByText("Datatable customization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^all tables/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^catalog/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sales & orders/i })).toBeInTheDocument();
  });

  it("switches active table from selector pills", () => {
    renderSection();

    const salesPill = screen.getByRole("button", { name: /sales history/i });
    expect(salesPill).toBeInTheDocument();

    fireEvent.click(salesPill);
    expect(mockContext.getTableConfig).toHaveBeenCalledWith("sales");
  });

  it("renames column label", () => {
    renderSection();

    const skuInput = screen.getByPlaceholderText("SKU");
    expect(skuInput).toBeInTheDocument();

    fireEvent.change(skuInput, { target: { value: "Product Code" } });
    expect(mockContext.setColumnLabel).toHaveBeenCalledWith(
      "items",
      "sku",
      "Product Code"
    );
  });

  it("reorders column up and down", () => {
    renderSection();

    const moveSkuUpBtn = screen.getByRole("button", { name: "Move SKU up" });
    expect(moveSkuUpBtn).toBeInTheDocument();

    fireEvent.click(moveSkuUpBtn);
    expect(mockContext.moveColumnOrder).toHaveBeenCalledWith("items", "sku", "up");
  });

  it("toggles column visibility", () => {
    renderSection();

    const hideSkuBtn = screen.getByRole("button", { name: "Hide SKU" });
    expect(hideSkuBtn).toBeInTheDocument();

    fireEvent.click(hideSkuBtn);
    expect(mockContext.setColumnVisibility).toHaveBeenCalledWith("items", "sku", false);
  });

  it("changes column text alignment", () => {
    renderSection();

    const alignCenterBtn = screen.getByRole("button", { name: "Align SKU center" });
    expect(alignCenterBtn).toBeInTheDocument();

    fireEvent.click(alignCenterBtn);
    expect(mockContext.setColumnAlign).toHaveBeenCalledWith("items", "sku", "center");
  });

  it("changes table density, page size, row numbers, and zebra striping", () => {
    const { container } = renderSection();

    // Density
    const compactBtn = screen.getByRole("button", { name: "compact" });
    fireEvent.click(compactBtn);
    expect(mockContext.setTableDensity).toHaveBeenCalledWith("items", "compact");

    // Page size
    const pageSizeSelect = screen.getByRole("combobox", { name: /default rows per page/i });
    fireEvent.change(pageSizeSelect, { target: { value: "50" } });
    expect(mockContext.setTablePageSize).toHaveBeenCalledWith("items", 50);

    // Row numbers checkbox
    const rowNumbersCheckbox = container.querySelector<HTMLInputElement>(
      "#row-numbers-items"
    );
    expect(rowNumbersCheckbox).not.toBeNull();
    fireEvent.click(rowNumbersCheckbox!);
    expect(mockContext.setShowRowNumbers).toHaveBeenCalledWith("items", false);

    // Zebra striping checkbox
    const zebraCheckbox = container.querySelector<HTMLInputElement>(
      "#zebra-items"
    );
    expect(zebraCheckbox).not.toBeNull();
    fireEvent.click(zebraCheckbox!);
    expect(mockContext.setZebraStriping).toHaveBeenCalledWith("items", false);
  });

  it("filters tables using search input", () => {
    renderSection();

    const searchInput = screen.getByPlaceholderText("Search tables or columns…");
    fireEvent.change(searchInput, { target: { value: "Z-Reports" } });

    expect(screen.getByRole("button", { name: /z-reports/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /products & catalog/i })).not.toBeInTheDocument();
  });

  it("opens reset table and reset all confirmation dialogs", () => {
    renderSection();

    // Reset this table
    const resetTableBtn = screen.getByRole("button", { name: /reset this table/i });
    fireEvent.click(resetTableBtn);
    expect(screen.getByText(/Reset Products & catalog items\?/i)).toBeInTheDocument();

    // Reset all tables
    const resetAllBtn = screen.getByRole("button", { name: /reset all tables/i });
    fireEvent.click(resetAllBtn);
    expect(screen.getByText(/Reset all tables to system defaults\?/i)).toBeInTheDocument();
  });
});
