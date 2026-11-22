import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import {
  TableCustomizationContext,
  type TableCustomizationContextValue,
  type TableDensity,
} from "@/contexts/TableCustomizationContext";
import { ItemsListPage } from "./ItemsListPage";
import * as orgsApi from "@/api/orgs";
import * as itemsApi from "@/api/items";
import * as categoriesApi from "@/api/categories";
import * as itemsPdfUtil from "@/utils/itemsPdf";

vi.mock("@/api/orgs");
vi.mock("@/api/items");
vi.mock("@/api/categories");
vi.mock("@/utils/itemsPdf");

function wrap(component: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      orgContext: orgContextReducer,
      cart: cartReducer,
    },
    preloadedState: {
      auth: {
        token: "test-token",
        iamUserId: "user-1",
        username: null,
        expiresAt: null,
        refreshToken: null,
        roles: [],
      },
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>{component}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}

describe("ItemsListPage Download PDF", () => {
  const mockItems = [
    {
      id: "item-1",
      orgId: "org-1",
      sku: "SKU-1",
      name: "Tusker Lager",
      itemType: "STOCK" as const,
      categoryId: null,
      taxProfileId: null,
      trackInventory: true,
      active: true,
      buyingPrice: 180,
      defaultSellingPrice: 250,
      baseUomId: null,
      visibleInPos: true,
      primaryImageUrl: null,
      barcode: "123456",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [
        {
          id: "org-1",
          name: "Acme Pubs",
          status: "ACTIVE",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 200,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(itemsApi.fetchItems).mockResolvedValue({
      content: mockItems,
      totalElements: 1,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(itemsApi.fetchAllOrgItems).mockResolvedValue(mockItems);

    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });
  });

  it("renders Download button and triggers downloadItemsPdf", async () => {
    wrap(<ItemsListPage initialOrgId="org-1" />);

    expect(await screen.findByText("Tusker Lager")).toBeInTheDocument();

    const downloadBtn = await screen.findByRole("button", { name: /^download$/i });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(itemsApi.fetchAllOrgItems).toHaveBeenCalledWith("test-token", "org-1");
      expect(itemsPdfUtil.downloadItemsPdf).toHaveBeenCalledWith(mockItems, {
        orgName: "Acme Pubs",
      });
    });
  });

  it("renders Add item form with Image label, tooltip, and checkboxes", async () => {
    wrap(<ItemsListPage initialOrgId="org-1" />);

    expect(await screen.findByText("Tusker Lager")).toBeInTheDocument();

    const addItemBtn = screen.getByRole("button", { name: /add item/i });
    fireEvent.click(addItemBtn);

    const dialog = screen.getByRole("dialog");

    // Old label "Item image (optional)" should not exist
    expect(within(dialog).queryByText("Item image (optional)")).not.toBeInTheDocument();

    // New label "Image" should be present in the dialog
    expect(within(dialog).getByText("Image")).toBeInTheDocument();

    // Tooltip role should contain the resize specifications
    const tooltip = within(dialog).getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Auto-resized to 400×400 px. JPEG, PNG or WebP, max 5MB.");

    // Checkboxes should be present in the dialog
    expect(within(dialog).getByLabelText(/track inventory/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/visible in pos/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/active/i)).toBeInTheDocument();

    // Tax profile should be hidden
    expect(within(dialog).queryByText("Tax profile")).not.toBeInTheDocument();

    // Amount labels should not have (KES)
    expect(within(dialog).queryByText(/Buying price \(KES\)/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Selling price \(KES\)/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Buying price/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Selling price/i)).toBeInTheDocument();

    // Name, SKU, Buying price, and Selling price should be required
    expect(within(dialog).getByLabelText(/Name/i)).toBeRequired();
    expect(within(dialog).getByLabelText(/SKU/i)).toBeRequired();
    expect(within(dialog).getByLabelText(/Buying price/i)).toBeRequired();
    expect(within(dialog).getByLabelText(/Selling price/i)).toBeRequired();

    // Submit button should say "Save" and be disabled when required fields are empty
    const saveBtn = within(dialog).getByRole("button", { name: "Save" });
    expect(saveBtn).toBeInTheDocument();
    expect(saveBtn).toBeDisabled();

    // Filling required fields should enable the Save button
    fireEvent.change(within(dialog).getByLabelText(/Name/i), { target: { value: "New Item" } });
    fireEvent.change(within(dialog).getByLabelText(/SKU/i), { target: { value: "SKU-001" } });
    fireEvent.change(within(dialog).getByLabelText(/Buying price/i), { target: { value: "100" } });
    fireEvent.change(within(dialog).getByLabelText(/Selling price/i), { target: { value: "150" } });

    expect(saveBtn).not.toBeDisabled();
  });

  it("renders table with customized column labels, order, and hidden columns", async () => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({ content: [{ id: "org-1", name: "Org 1" }], totalPages: 1, totalElements: 1 } as any);
    vi.mocked(itemsApi.fetchItems).mockResolvedValue({ content: mockItems, totalPages: 1 } as any);
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({ content: [] } as any);

    const mockTableCtx: TableCustomizationContextValue = {
      getTableConfig: vi.fn(() => [
        {
          key: "name",
          label: "Custom Item Name",
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
          label: "Inventory SKU Code",
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
          key: "actions",
          label: "Item Actions",
          defaultLabel: "Actions",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 3,
          defaultOrder: 3,
          align: "left" as const,
          sortable: false,
        },
      ]),
      getVisibleColumns: vi.fn(() => [
        {
          key: "name",
          label: "Custom Item Name",
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
          label: "Inventory SKU Code",
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
          key: "actions",
          label: "Item Actions",
          defaultLabel: "Actions",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 3,
          defaultOrder: 3,
          align: "left" as const,
          sortable: false,
        },
      ]),
      isColumnVisible: vi.fn((_t, col) => col === "name" || col === "sku" || col === "actions"),
      getColumnLabel: vi.fn((_t, col) => (col === "name" ? "Custom Item Name" : col === "sku" ? "Inventory SKU Code" : col)),
      getColumnAlign: vi.fn(() => "left" as const),
      getTableDensity: vi.fn(() => "compact" as TableDensity),
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

    const store = configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
        cart: cartReducer,
      },
      preloadedState: {
        auth: {
          token: "test-token",
          iamUserId: "user-1",
          username: null,
          expiresAt: null,
          refreshToken: null,
          roles: [],
        },
        orgContext: {
          orgId: "org-1",
          branchId: "branch-1",
          terminalId: "term-1",
          orgName: "Org 1",
          branchName: "Branch 1",
          terminalName: "Term 1",
        },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <TableCustomizationContext.Provider value={mockTableCtx}>
              <MemoryRouter>
                <ItemsListPage initialOrgId="org-1" />
              </MemoryRouter>
            </TableCustomizationContext.Provider>
          </ToastProvider>
        </QueryClientProvider>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Custom item name")).toBeInTheDocument();
      expect(screen.getByText("Inventory SKU code")).toBeInTheDocument();
      expect(screen.getByText("Item actions")).toBeInTheDocument();
      // Barcode was omitted from visibleColumns, verify it is not in the table headers
      expect(screen.queryByRole("columnheader", { name: /^barcode$/i })).not.toBeInTheDocument();
    });
  });
});

