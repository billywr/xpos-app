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
import { NavVisibilityContext } from "@/contexts/NavVisibilityContext";
import {
  GoodsReceiptPage,
  isReceiptInDateRange,
  getDayOffsetLabel,
} from "./GoodsReceiptPage";
import * as orgsApi from "@/api/orgs";
import * as branchesApi from "@/api/branches";
import * as suppliersApi from "@/api/suppliers";
import * as grnApi from "@/api/goodsReceiptNotes";
import * as itemsApi from "@/api/items";
import * as itemsPdfUtil from "@/utils/itemsPdf";
import { formatDate, formatDateInput } from "@/utils/formatDate";

vi.mock("@/api/orgs");
vi.mock("@/api/branches");
vi.mock("@/api/suppliers");
vi.mock("@/api/goodsReceiptNotes");
vi.mock("@/api/items");
vi.mock("@/utils/itemsPdf");

function wrap(
  component: React.ReactElement,
  navLabels?: Record<string, string>
) {
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
  const navValue = {
    adminVisibility: {},
    operatorVisibility: {},
    headerVisibility: {},
    adminLabels: navLabels ?? {},
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
    getAdminLabel: (_: string, def: string) => def,
    getOperatorLabel: (_: string, def: string) => def,
    getHeaderLabel: (_: string, def: string) => def,
    getHeaderLogo: () => null,
    setHeaderLogo: vi.fn(),
    darkTheme: "petrol",
    setDarkTheme: vi.fn(),
    isLoading: false,
    isSaving: false,
    needsOrgSelection: false,
  };
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <NavVisibilityContext.Provider value={navValue}>
            <MemoryRouter>{component}</MemoryRouter>
          </NavVisibilityContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}

describe("isReceiptInDateRange helper", () => {
  const refDate = new Date("2026-09-29T12:00:00Z");

  it("handles 'all' preset by returning true for any date", () => {
    expect(isReceiptInDateRange("2026-01-01T00:00:00Z", "all", undefined, undefined, refDate)).toBe(true);
    expect(isReceiptInDateRange("2026-09-29T10:00:00Z", "all", undefined, undefined, refDate)).toBe(true);
  });

  it("handles 'today' preset accurately in local day", () => {
    const todayIso = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 10, 0, 0).toISOString();
    const yesterdayIso = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 1, 10, 0, 0).toISOString();
    expect(isReceiptInDateRange(todayIso, "today", undefined, undefined, refDate)).toBe(true);
    expect(isReceiptInDateRange(yesterdayIso, "today", undefined, undefined, refDate)).toBe(false);
  });

  it("handles '7days' preset", () => {
    const fourDaysAgo = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 4, 10, 0, 0).toISOString();
    const eightDaysAgo = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 8, 10, 0, 0).toISOString();
    expect(isReceiptInDateRange(fourDaysAgo, "7days", undefined, undefined, refDate)).toBe(true);
    expect(isReceiptInDateRange(eightDaysAgo, "7days", undefined, undefined, refDate)).toBe(false);
  });

  it("handles '30days' preset", () => {
    const twentyDaysAgo = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 20, 10, 0, 0).toISOString();
    const thirtyFiveDaysAgo = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 35, 10, 0, 0).toISOString();
    expect(isReceiptInDateRange(twentyDaysAgo, "30days", undefined, undefined, refDate)).toBe(true);
    expect(isReceiptInDateRange(thirtyFiveDaysAgo, "30days", undefined, undefined, refDate)).toBe(false);
  });

  it("handles 'thisMonth' preset", () => {
    const startOfCurrentMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 2, 10, 0, 0).toISOString();
    const prevMonth = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 15, 10, 0, 0).toISOString();
    expect(isReceiptInDateRange(startOfCurrentMonth, "thisMonth", undefined, undefined, refDate)).toBe(true);
    expect(isReceiptInDateRange(prevMonth, "thisMonth", undefined, undefined, refDate)).toBe(false);
  });

  it("handles 'custom' date range", () => {
    const inRange = "2026-05-15T10:00:00Z";
    const beforeRange = "2026-04-20T10:00:00Z";
    const afterRange = "2026-06-10T10:00:00Z";
    expect(isReceiptInDateRange(inRange, "custom", "2026-05-01", "2026-05-31", refDate)).toBe(true);
    expect(isReceiptInDateRange(beforeRange, "custom", "2026-05-01", "2026-05-31", refDate)).toBe(false);
    expect(isReceiptInDateRange(afterRange, "custom", "2026-05-01", "2026-05-31", refDate)).toBe(false);
  });

  it("getDayOffsetLabel generates appropriate labels based on day offset", () => {
    const fixedNow = new Date("2026-11-19T12:00:00Z");
    expect(getDayOffsetLabel(0, fixedNow)).toBe("Today");
    expect(getDayOffsetLabel(1, fixedNow)).toBe("Yesterday");
    expect(getDayOffsetLabel(2, fixedNow)).toContain("Nov 17");
  });

  it("handles 'today' preset with dayOffset for yesterday and previous days", () => {
    const todayIso = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 10, 0, 0).toISOString();
    const yesterdayIso = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 1, 10, 0, 0).toISOString();
    const twoDaysAgoIso = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 2, 10, 0, 0).toISOString();

    // offset 0 is today
    expect(isReceiptInDateRange(todayIso, "today", undefined, undefined, refDate, 0)).toBe(true);
    expect(isReceiptInDateRange(yesterdayIso, "today", undefined, undefined, refDate, 0)).toBe(false);

    // offset 1 is yesterday
    expect(isReceiptInDateRange(yesterdayIso, "today", undefined, undefined, refDate, 1)).toBe(true);
    expect(isReceiptInDateRange(todayIso, "today", undefined, undefined, refDate, 1)).toBe(false);

    // offset 2 is 2 days ago
    expect(isReceiptInDateRange(twoDaysAgoIso, "today", undefined, undefined, refDate, 2)).toBe(true);
    expect(isReceiptInDateRange(yesterdayIso, "today", undefined, undefined, refDate, 2)).toBe(false);
  });
});

describe("GoodsReceiptPage Intelligence & Filters", () => {
  const now = new Date();
  const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
  const fiveDaysAgoIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 12, 0, 0).toISOString();
  const twentyDaysAgoIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 20, 12, 0, 0).toISOString();

  const mockGrns = [
    {
      id: "grn-today",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: todayIso,
      createdAt: todayIso,
      active: true,
      lines: [
        {
          id: "line-1",
          grnId: "grn-today",
          itemId: "item-1",
          itemName: "Guinness bottle",
          barcode: "123456",
          qty: 10,
          uomId: null,
          receivedUnitCost: 200,
          createdAt: todayIso,
        },
      ],
    },
    {
      id: "grn-5days",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-2",
      supplierName: "Kenya Wine Agencies",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: fiveDaysAgoIso,
      createdAt: fiveDaysAgoIso,
      active: true,
      lines: [
        {
          id: "line-2",
          grnId: "grn-5days",
          itemId: "item-2",
          itemName: "Viceroy 750ml",
          barcode: "789012",
          qty: 5,
          uomId: null,
          receivedUnitCost: 1000,
          createdAt: fiveDaysAgoIso,
        },
      ],
    },
    {
      id: "grn-20days",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: twentyDaysAgoIso,
      createdAt: twentyDaysAgoIso,
      active: true,
      lines: [
        {
          id: "line-3",
          grnId: "grn-20days",
          itemId: "item-3",
          itemName: "Tusker Lager",
          barcode: "345678",
          qty: 20,
          uomId: null,
          receivedUnitCost: 150,
          createdAt: twentyDaysAgoIso,
        },
      ],
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

    vi.mocked(branchesApi.fetchBranches).mockResolvedValue({
      content: [
        {
          id: "branch-1",
          name: "Main Branch",
          orgId: "org-1",
          businessId: "biz-1",
          timezone: "Africa/Nairobi",
          currency: "KES",
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

    vi.mocked(suppliersApi.fetchSuppliers).mockResolvedValue({
      content: [
        {
          id: "sup-1",
          orgId: "org-1",
          name: "East Africa Breweries",
          phone: "0712345678",
          email: "john@eabl.com",
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "sup-2",
          orgId: "org-1",
          name: "Kenya Wine Agencies",
          phone: "0787654321",
          email: "mary@kwal.com",
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      totalElements: 2,
      totalPages: 1,
      size: 200,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: mockGrns,
      totalElements: 3,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(itemsApi.fetchItems).mockResolvedValue({
      content: [
        {
          id: "item-1",
          orgId: "org-1",
          sku: "SKU-1",
          name: "Guinness bottle",
          itemType: "STOCK",
          categoryId: null,
          taxProfileId: null,
          trackInventory: true,
          active: true,
          buyingPrice: 200,
          defaultSellingPrice: 280,
          baseUomId: null,
          visibleInPos: true,
          primaryImageUrl: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "item-3",
          orgId: "org-1",
          sku: "SKU-3",
          name: "Tusker Lager",
          itemType: "STOCK",
          categoryId: null,
          taxProfileId: null,
          trackInventory: true,
          active: true,
          buyingPrice: 150,
          defaultSellingPrice: 220,
          baseUomId: null,
          visibleInPos: true,
          primaryImageUrl: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      totalElements: 2,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(itemsApi.fetchAllOrgItems).mockResolvedValue([
      {
        id: "item-1",
        orgId: "org-1",
        sku: "SKU-1",
        name: "Guinness bottle",
        itemType: "STOCK",
        categoryId: null,
        taxProfileId: null,
        trackInventory: true,
        active: true,
        buyingPrice: 200,
        defaultSellingPrice: 280,
        baseUomId: null,
        visibleInPos: true,
        primaryImageUrl: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ]);
  });

  it("renders stock receiving with initial 'All' range and switches to 'Today' to calculate today's KPI", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Default is All: 35 units, 10,000 value
    const kpi = screen.getByLabelText("Stock KPI summary");
    expect(within(kpi).getByText("Total")).toBeInTheDocument();
    expect(within(kpi).getByText(/10,000/)).toBeInTheDocument();
    expect(within(kpi).queryByText("Receipts")).not.toBeInTheDocument();
    expect(within(kpi).getByText("Units")).toBeInTheDocument();
    expect(within(kpi).getByText("35")).toBeInTheDocument();

    // Presets exist
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7 Days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 Days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This Month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();

    // Click "Today" to view today's receipts only
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => {
      expect(within(kpi).getByText(/2,000/)).toBeInTheDocument();
    });
    expect(within(kpi).getByText("10")).toBeInTheDocument();
  });

  it("filters to 'Today' and dynamically updates total value to today's receipts only", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Click "Today" preset
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    const kpi = screen.getByLabelText("Stock KPI summary");
    // Today's total is 10 * 200 = 2,000
    await waitFor(() => {
      expect(within(kpi).getByText(/2,000/)).toBeInTheDocument();
    });
    expect(within(kpi).getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    expect(screen.queryByText("Viceroy 750ml")).not.toBeInTheDocument();
    expect(screen.queryByText("Tusker Lager")).not.toBeInTheDocument();

    // Reset filters button is visible
    expect(screen.getByRole("button", { name: "Reset filters" })).toBeInTheDocument();
  });

  it("filters to '7 Days' and dynamically updates total value", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Click "7 Days" preset
    fireEvent.click(screen.getByRole("button", { name: "7 Days" }));

    const kpi = screen.getByLabelText("Stock KPI summary");
    // 7 days includes today (2,000) and 5 days ago (5,000) = 7,000
    await waitFor(() => {
      expect(within(kpi).getByText(/7,000/)).toBeInTheDocument();
    });
    expect(within(kpi).getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    expect(screen.getByText("Viceroy 750ml")).toBeInTheDocument();
    expect(screen.queryByText("Tusker Lager")).not.toBeInTheDocument();
  });

  it("resets filters when clicking Reset filters", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    const kpi = screen.getByLabelText("Stock KPI summary");
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => {
      expect(within(kpi).getByText(/2,000/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() => {
      expect(within(kpi).getByText(/10,000/)).toBeInTheDocument();
    });
    expect(within(kpi).getByText("35")).toBeInTheDocument();
    // Button stays visible and does not vanish
    expect(screen.getByRole("button", { name: "Reset filters" })).toBeInTheDocument();
  });

  it("filters by custom date range inputs", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    // From and To date inputs appear
    const fromInput = screen.getByLabelText("From:") as HTMLInputElement;
    const toInput = screen.getByLabelText("To:") as HTMLInputElement;
    expect(fromInput).toBeInTheDocument();
    expect(toInput).toBeInTheDocument();

    // Set custom range that only covers the 20-days-ago receipt
    const past25 = new Date(now);
    past25.setDate(past25.getDate() - 25);
    const past15 = new Date(now);
    past15.setDate(past15.getDate() - 15);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    fireEvent.change(fromInput, { target: { value: fmt(past25) } });
    fireEvent.change(toInput, { target: { value: fmt(past15) } });

    // Only the 20-days-ago receipt (Tusker Lager, 20 * 150 = 3,000) matches
    await waitFor(() => {
      expect(screen.getAllByText(/3,000/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("Tusker Lager")).toBeInTheDocument();
    expect(screen.queryByText("Guinness bottle")).not.toBeInTheDocument();
    expect(screen.queryByText("Viceroy 750ml")).not.toBeInTheDocument();
  });

  it("filters by supplier dropdown", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Switch to All range first so receipts from 5 days ago are included
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(screen.getAllByText(/10,000/).length).toBeGreaterThanOrEqual(1);
    });

    // Select Kenya Wine Agencies (sup-2) which has only Viceroy 750ml (5 * 1000 = 5,000)
    const supplierSelect = screen.getByPlaceholderText("Filter by supplier…");
    fireEvent.change(supplierSelect, { target: { value: "Kenya Wine Agencies" } });

    await waitFor(() => {
      expect(screen.getByText("Kenya Wine Agencies")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Kenya Wine Agencies"));

    await waitFor(() => {
      expect(screen.getAllByText(/5,000/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("Viceroy 750ml")).toBeInTheDocument();
    expect(screen.queryByText("Guinness bottle")).not.toBeInTheDocument();
    expect(screen.queryByText("Tusker Lager")).not.toBeInTheDocument();
  });

  it("renders Download button and triggers downloadItemsPdf", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole("button", { name: /^download$/i });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(itemsApi.fetchAllOrgItems).toHaveBeenCalledWith("test-token", "org-1");
      expect(itemsPdfUtil.downloadItemsPdf).toHaveBeenCalled();
    });
  });

  it("dynamically shows saved items in the dropdown subject strictly to the selected receivedAt date", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Open Add Stock slide-over
    const receiveBtn = screen.getByRole("button", { name: /^add$/i });
    fireEvent.click(receiveBtn);

    // Slide-over opens
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add stock" })).toBeInTheDocument();
      expect(screen.getByText("Receive")).toBeInTheDocument();
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
      expect(screen.queryByText(/Items already on another receipt/i)).not.toBeInTheDocument();
    });

    const itemCombobox = screen.getByPlaceholderText("Search item name, SKU, barcode…");
    const dateInput = screen.getByLabelText(/received at/i) as HTMLInputElement;

    // 1. By default, date is today. Supplier is East Africa Breweries (sup-1).
    // Guinness bottle was received today from sup-1, so it should be excluded.
    // Tusker Lager was received 20 days ago from sup-1, so it should be available.
    fireEvent.focus(itemCombobox);
    fireEvent.click(itemCombobox);

    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("Tusker Lager")).toBeInTheDocument();
      expect(within(listbox).queryByText("Guinness bottle")).not.toBeInTheDocument();
    });

    // 2. Change receivedAt date to 20 days ago
    const past20 = new Date(now);
    past20.setDate(past20.getDate() - 20);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    fireEvent.change(dateInput, { target: { value: fmt(past20) } });

    // Now Guinness bottle (received today) should become AVAILABLE!
    // And Tusker Lager (received 20 days ago) should be excluded.
    fireEvent.focus(itemCombobox);
    fireEvent.click(itemCombobox);

    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("Guinness bottle")).toBeInTheDocument();
      expect(within(listbox).queryByText("Tusker Lager")).not.toBeInTheDocument();
    });

    // 3. Change receivedAt date to 10 days ago (neither item was received on that day)
    const past10 = new Date(now);
    past10.setDate(past10.getDate() - 10);
    fireEvent.change(dateInput, { target: { value: fmt(past10) } });

    fireEvent.focus(itemCombobox);
    fireEvent.click(itemCombobox);

    // Both items should be available in the dropdown
    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("Guinness bottle")).toBeInTheDocument();
      expect(within(listbox).getByText("Tusker Lager")).toBeInTheDocument();
    });
  });

  it("displays Receive title and calculates dynamic total at top of lines", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Open Add Stock slide-over
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add stock" })).toBeInTheDocument();
      expect(screen.getByText("Receive")).toBeInTheDocument();
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
      expect(screen.getByText("Qty*")).toBeInTheDocument();
      expect(screen.getAllByText("Units").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Total").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/Items already on another receipt/i)).not.toBeInTheDocument();
    });

    // Select Tusker Lager (item-3, buyingPrice 150)
    const itemCombobox = screen.getByPlaceholderText("Search item name, SKU, barcode…");
    fireEvent.focus(itemCombobox);
    fireEvent.click(itemCombobox);

    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      fireEvent.click(within(listbox).getByText("Tusker Lager"));
    });

    // Set qty to 4. Total should be 4 * 150 = 600
    const qtyInput = screen.getByPlaceholderText("0");
    fireEvent.change(qtyInput, { target: { value: "4" } });

    await waitFor(() => {
      expect(screen.getByLabelText(/Total: KSh\s*600/i)).toBeInTheDocument();
    });
  });

  it("preserves exact receivedAt timestamp when editing single line without changing date", async () => {
    const multiLineGrn = {
      id: "grn-multi",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: "2026-11-18T10:15:30Z",
      createdAt: "2026-11-18T10:15:30Z",
      active: true,
      lines: [
        {
          id: "line-a",
          grnId: "grn-multi",
          itemId: "item-1",
          itemName: "Guinness bottle",
          barcode: "123456",
          qty: 10,
          uomId: null,
          receivedUnitCost: 200,
          createdAt: "2026-11-18T10:15:30Z",
        },
        {
          id: "line-b",
          grnId: "grn-multi",
          itemId: "item-3",
          itemName: "Tusker Lager",
          barcode: "345678",
          qty: 20,
          uomId: null,
          receivedUnitCost: 150,
          createdAt: "2026-11-18T10:15:30Z",
        },
      ],
    };

    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: [multiLineGrn],
      totalElements: 1,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(grnApi.updateGoodsReceiptNote).mockResolvedValue(multiLineGrn);

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    // Switch to All range so receipt is visible
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Click edit on line-a
    const editLineBtn = screen.getByLabelText("Edit line Guinness bottle");
    fireEvent.click(editLineBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit line" })).toBeInTheDocument();
    });

    // Change qty from 10 to 12 without changing date
    const qtyInput = screen.getByDisplayValue("10");
    fireEvent.change(qtyInput, { target: { value: "12" } });

    // Submit
    const saveBtn = screen.getByRole("button", { name: /save line/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(grnApi.updateGoodsReceiptNote).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        "grn-multi",
        expect.objectContaining({
          receivedAt: "2026-11-18T10:15:30Z", // exact timestamp preserved!
          lines: expect.arrayContaining([
            expect.objectContaining({ itemId: "item-1", qty: 12 }),
            expect.objectContaining({ itemId: "item-3", qty: 20 }),
          ]),
        })
      );
    });
  });

  it("splits item into a new receipt when editing single line and changing receiving date", async () => {
    const multiLineGrn = {
      id: "grn-multi",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: "2026-11-17T15:00:00Z",
      createdAt: "2026-11-17T15:00:00Z",
      active: true,
      lines: [
        {
          id: "line-a",
          grnId: "grn-multi",
          itemId: "item-1",
          itemName: "Guinness bottle",
          barcode: "123456",
          qty: 10,
          uomId: null,
          receivedUnitCost: 200,
          createdAt: "2026-11-17T15:00:00Z",
        },
        {
          id: "line-b",
          grnId: "grn-multi",
          itemId: "item-3",
          itemName: "Tusker Lager",
          barcode: "345678",
          qty: 20,
          uomId: null,
          receivedUnitCost: 150,
          createdAt: "2026-11-17T15:00:00Z",
        },
      ],
    };

    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: [multiLineGrn],
      totalElements: 1,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(grnApi.updateGoodsReceiptNote).mockResolvedValue(multiLineGrn);
    vi.mocked(grnApi.createGoodsReceiptNote).mockResolvedValue({ ...multiLineGrn, id: "grn-new" });

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    // Switch to All range so yesterday's receipt is visible
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Click edit on line-a
    const editLineBtn = screen.getByLabelText("Edit line Guinness bottle");
    fireEvent.click(editLineBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit line" })).toBeInTheDocument();
    });

    // Change receivedAt to a new date (2026-11-10)
    const dateInput = screen.getByLabelText(/received at/i);
    fireEvent.change(dateInput, { target: { value: "2026-11-10" } });

    // Submit
    const saveBtn = screen.getByRole("button", { name: /save line/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      // 1. Original receipt is updated with ONLY remaining line (line-b), preserving original date
      expect(grnApi.updateGoodsReceiptNote).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        "grn-multi",
        expect.objectContaining({
          receivedAt: "2026-11-17T15:00:00Z",
          lines: [expect.objectContaining({ itemId: "item-3", qty: 20 })],
        })
      );

      // 2. New receipt is created for line-a on the new date
      expect(grnApi.createGoodsReceiptNote).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        expect.objectContaining({
          branchId: "branch-1",
          supplierId: "sup-1",
          lines: [expect.objectContaining({ itemId: "item-1", qty: 10 })],
        })
      );
    });
  });

  it("disables submit button when item or qty is empty and activates it when filled", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Open Add Stock slide-over
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add stock" })).toBeInTheDocument();
    });

    // The submit button inside the slide-over
    const submitBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: /\+ save/i,
    });

    // Initially, item is unselected and qty is empty -> submit must be disabled
    expect(submitBtn).toBeDisabled();

    // Select an item
    const itemCombobox = screen.getByPlaceholderText("Search item name, SKU, barcode…");
    fireEvent.focus(itemCombobox);
    fireEvent.click(itemCombobox);

    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      fireEvent.click(within(listbox).getByText("Tusker Lager"));
    });

    // Item selected, but qty is still empty -> submit still disabled
    expect(submitBtn).toBeDisabled();

    // Enter qty 0 -> submit still disabled
    const qtyInput = screen.getByPlaceholderText("0");
    fireEvent.change(qtyInput, { target: { value: "0" } });
    expect(submitBtn).toBeDisabled();

    // Enter positive qty 5 -> submit becomes enabled!
    fireEvent.change(qtyInput, { target: { value: "5" } });
    expect(submitBtn).toBeEnabled();
  });

  it("navigates backwards and forwards through days using the Today back icon", async () => {
    const yesterdayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0).toISOString();
    const customGrns = [
      ...mockGrns,
      {
        id: "grn-yesterday",
        orgId: "org-1",
        branchId: "branch-1",
        supplierId: "sup-1",
        supplierName: "East Africa Breweries",
        purchaseOrderId: null,
        receivedByStaffUserId: "user-1",
        receivedAt: yesterdayIso,
        createdAt: yesterdayIso,
        active: true,
        lines: [
          {
            id: "line-yesterday",
            grnId: "grn-yesterday",
            itemId: "item-yesterday",
            itemName: "Yesterday Soda",
            barcode: "999888",
            qty: 12,
            uomId: null,
            receivedUnitCost: 50,
            createdAt: yesterdayIso,
          },
        ],
      },
    ];
    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: customGrns,
      totalElements: 4,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    wrap(<GoodsReceiptPage />);

    // Initially "All" is active, showing all receipts including Guinness bottle and Yesterday Soda
    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
      expect(screen.getByText("Yesterday Soda")).toBeInTheDocument();
    });

    // Next day button is disabled on Today
    const nextDayBtn = screen.getByRole("button", { name: /next day/i });
    expect(nextDayBtn).toBeDisabled();

    // Click "Previous day" icon button
    const prevDayBtn = screen.getByRole("button", { name: /previous day/i });
    fireEvent.click(prevDayBtn);

    // Now label should change to "Yesterday", showing Yesterday Soda and not Guinness bottle
    await waitFor(() => {
      expect(screen.getByText("Yesterday")).toBeInTheDocument();
      expect(screen.getByText("Yesterday Soda")).toBeInTheDocument();
      expect(screen.queryByText("Guinness bottle")).not.toBeInTheDocument();
    });

    // Next day button should now be enabled
    expect(nextDayBtn).not.toBeDisabled();

    // Click next day button to return to Today
    fireEvent.click(nextDayBtn);

    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
      expect(screen.queryByText("Yesterday Soda")).not.toBeInTheDocument();
      expect(nextDayBtn).toBeDisabled();
    });
  });

  it("does not render 0-line empty receipts as dashed rows and auto-purges them", async () => {
    const emptyGrn = {
      id: "grn-empty-ghost",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: todayIso,
      createdAt: todayIso,
      active: true,
      lines: [],
    };

    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: [mockGrns[0], emptyGrn],
      totalElements: 2,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(grnApi.deleteGoodsReceiptNotePermanently).mockResolvedValue(undefined as any);

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Verify auto-purge called for empty receipt
    await waitFor(() => {
      expect(grnApi.deleteGoodsReceiptNotePermanently).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        "grn-empty-ghost"
      );
    });

    // Ensure no dashed placeholder row is rendered in the table
    const tableRows = screen.getAllByRole("row");
    // Header row + 1 data row (only Guinness bottle) = 2 rows
    expect(tableRows).toHaveLength(2);
  });

  it("deleting the only line of a receipt permanently deletes the receipt", async () => {
    vi.mocked(grnApi.deleteGoodsReceiptNotePermanently).mockResolvedValue(undefined as any);

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Click trash button for Guinness bottle
    const deleteBtn = screen.getByLabelText("Remove line Guinness bottle");
    fireEvent.click(deleteBtn);

    // Confirm dialog
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Remove receipt item?" })).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(grnApi.deleteGoodsReceiptNotePermanently).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        "grn-today"
      );
    });
  });

  it("does not render 'Edit all lines' or 'Delete entire receipt' buttons", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/edit all lines/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/delete entire receipt/i)).not.toBeInTheDocument();
  });

  it("supports multi-delete across selected rows", async () => {
    const multiLineGrn = {
      id: "grn-multi",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: todayIso,
      createdAt: todayIso,
      active: true,
      lines: [
        {
          id: "line-a",
          grnId: "grn-multi",
          itemId: "item-1",
          itemName: "Item A",
          barcode: "111",
          qty: 5,
          uomId: null,
          receivedUnitCost: 100,
          createdAt: todayIso,
        },
        {
          id: "line-b",
          grnId: "grn-multi",
          itemId: "item-2",
          itemName: "Item B",
          barcode: "222",
          qty: 10,
          uomId: null,
          receivedUnitCost: 150,
          createdAt: todayIso,
        },
      ],
    };

    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: [multiLineGrn],
      totalElements: 1,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(grnApi.updateGoodsReceiptNote).mockResolvedValue(multiLineGrn);
    vi.mocked(grnApi.deleteGoodsReceiptNotePermanently).mockResolvedValue(undefined as any);

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Item A")).toBeInTheDocument();
      expect(screen.getByText("Item B")).toBeInTheDocument();
    });

    // Select Item A
    const checkboxA = screen.getByLabelText("Select Item A");
    fireEvent.click(checkboxA);

    // Selection actions appear with count on delete button and clear icon
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete selected \(1\)/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /clear selection/i })).toBeInTheDocument();
    });

    // Select Item B
    const checkboxB = screen.getByLabelText("Select Item B");
    fireEvent.click(checkboxB);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete selected \(2\)/i })).toBeInTheDocument();
    });

    // Click "Delete selected"
    const deleteSelectedBtn = screen.getByRole("button", { name: /delete selected/i });
    fireEvent.click(deleteSelectedBtn);

    // Confirmation dialog
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Delete selected items?" })).toBeInTheDocument();
    });

    const confirmModalBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmModalBtn);

    // Since both lines on grn-multi were selected, it should permanently delete the receipt
    await waitFor(() => {
      expect(grnApi.deleteGoodsReceiptNotePermanently).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        "grn-multi"
      );
    });
  });

  it("renders received column with date only and does not show time", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    const expectedDate = formatDate(todayIso);
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`${expectedDate},\\s*\\d{2}:\\d{2}`))).not.toBeInTheDocument();
  });

  it("shows the last added item at the top of the table", async () => {
    const multiItemGrn = {
      id: "grn-multi-order",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: todayIso,
      createdAt: todayIso,
      active: true,
      lines: [
        {
          id: "line-first",
          grnId: "grn-multi-order",
          itemId: "item-1",
          itemName: "Balozi bottle",
          barcode: "111",
          qty: 10,
          uomId: null,
          receivedUnitCost: 172,
          createdAt: todayIso,
        },
        {
          id: "line-middle",
          grnId: "grn-multi-order",
          itemId: "item-2",
          itemName: "Best whiskey 750ml",
          barcode: "222",
          qty: 9,
          uomId: null,
          receivedUnitCost: 1115,
          createdAt: todayIso,
        },
        {
          id: "line-last",
          grnId: "grn-multi-order",
          itemId: "item-3",
          itemName: "Blue ice 250ml",
          barcode: "333",
          qty: 100,
          uomId: null,
          receivedUnitCost: 150,
          createdAt: todayIso,
        },
      ],
    };

    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: [multiItemGrn],
      totalElements: 1,
      totalPages: 1,
      size: 15,
      number: 0,
      first: true,
      last: true,
    });

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Blue ice 250ml")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("row").map((r) => r.textContent);
    const blueIceRowIndex = rows.findIndex((txt) => txt?.includes("Blue ice 250ml"));
    const bestWhiskeyRowIndex = rows.findIndex((txt) => txt?.includes("Best whiskey 750ml"));
    const baloziRowIndex = rows.findIndex((txt) => txt?.includes("Balozi bottle"));

    expect(blueIceRowIndex).toBeGreaterThan(-1);
    expect(blueIceRowIndex).toBeLessThan(bestWhiskeyRowIndex);
    expect(bestWhiskeyRowIndex).toBeLessThan(baloziRowIndex);
  });

  it("flips back to max quantity when typing more than max value (e.g. 10000 becomes 99)", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Open Add Stock slide-over
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add stock" })).toBeInTheDocument();
    });

    // Max limit badge is hidden by default
    expect(screen.queryByText("max 99")).not.toBeInTheDocument();

    const qtyInput = screen.getByPlaceholderText("0");
    expect(qtyInput).toHaveAttribute("max", "99");

    // Entering "10000" flips back to max value: "99"
    fireEvent.change(qtyInput, { target: { value: "10000" } });
    expect(qtyInput).toHaveValue("99");

    // Entering "8788" flips back to max value: "99"
    fireEvent.change(qtyInput, { target: { value: "8788" } });
    expect(qtyInput).toHaveValue("99");

    // Valid value is preserved
    fireEvent.change(qtyInput, { target: { value: "50" } });
    expect(qtyInput).toHaveValue("50");
  });

  it("respects custom max quantity (e.g. 1,000), flips to max, and formats with comma separators", async () => {
    wrap(
      <GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />,
      {
        "admin.goods_receipt.max_qty": "1000",
        "admin.goods_receipt.show_limit": "true",
      }
    );

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Open Add Stock slide-over
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add stock" })).toBeInTheDocument();
    });

    // Indicator shows configured max 1,000 formatted with comma
    expect(screen.getByText("max 1,000")).toBeInTheDocument();

    const qtyInput = screen.getByPlaceholderText("0");
    expect(qtyInput).toHaveAttribute("max", "1000");

    // Can enter valid value formatted with comma
    fireEvent.change(qtyInput, { target: { value: "1000" } });
    expect(qtyInput).toHaveValue("1,000");

    // Typing more than max (8788) flips back to max value "1,000"
    fireEvent.change(qtyInput, { target: { value: "8788" } });
    expect(qtyInput).toHaveValue("1,000");
  });

  it("does not include inactive items in the item selection dropdown", async () => {
    vi.mocked(itemsApi.fetchItems).mockResolvedValue({
      content: [
        {
          id: "item-active",
          orgId: "org-1",
          sku: "ACT-1",
          name: "Active Lager",
          itemType: "STOCK",
          categoryId: null,
          taxProfileId: null,
          trackInventory: true,
          active: true,
          buyingPrice: 150,
          defaultSellingPrice: 200,
          baseUomId: null,
          visibleInPos: true,
          primaryImageUrl: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "item-inactive",
          orgId: "org-1",
          sku: "INACT-1",
          name: "Inactive Beer",
          itemType: "STOCK",
          categoryId: null,
          taxProfileId: null,
          trackInventory: true,
          active: false,
          buyingPrice: 100,
          defaultSellingPrice: 150,
          baseUomId: null,
          visibleInPos: true,
          primaryImageUrl: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      number: 0,
      size: 50,
      totalElements: 2,
      totalPages: 1,
      first: true,
      last: true,
    });

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Open Add Stock slide-over
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add stock" })).toBeInTheDocument();
    });

    // Open item dropdown
    const itemInput = screen.getByPlaceholderText(/search item name/i);
    fireEvent.mouseDown(itemInput);

    // Active item should be available
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /active lager/i })).toBeInTheDocument();
    });

    // Inactive item should NOT be available in dropdown options
    expect(screen.queryByRole("option", { name: /inactive beer/i })).not.toBeInTheDocument();
  });

  it("does not set indeterminate dash on select all checkbox when some rows are selected", async () => {
    const multiItemGrn = {
      id: "grn-multi-test",
      orgId: "org-1",
      branchId: "branch-1",
      supplierId: "sup-1",
      supplierName: "East Africa Breweries",
      purchaseOrderId: null,
      receivedByStaffUserId: "user-1",
      receivedAt: todayIso,
      createdAt: todayIso,
      active: true,
      lines: [
        {
          id: "line-1",
          grnId: "grn-multi-test",
          itemId: "item-1",
          itemName: "Bond7 250ml",
          barcode: "111",
          qty: 6,
          uomId: null,
          receivedUnitCost: 172,
          createdAt: todayIso,
        },
        {
          id: "line-2",
          grnId: "grn-multi-test",
          itemId: "item-2",
          itemName: "C. Mogan250ml",
          barcode: "222",
          qty: 7,
          uomId: null,
          receivedUnitCost: 1115,
          createdAt: todayIso,
        },
        {
          id: "line-3",
          grnId: "grn-multi-test",
          itemId: "item-3",
          itemName: "Tusker Lager 500ml",
          barcode: "333",
          qty: 24,
          uomId: null,
          receivedUnitCost: 180,
          createdAt: todayIso,
        },
      ],
    };

    vi.mocked(grnApi.fetchGoodsReceiptNotes).mockResolvedValue({
      content: [multiItemGrn],
      totalElements: 1,
      totalPages: 1,
      size: 15,
      number: 0,
      first: true,
      last: true,
    });

    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Bond7 250ml")).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByRole("checkbox", {
      name: /select all rows on this page/i,
    }) as HTMLInputElement;
    const checkbox1 = screen.getByRole("checkbox", { name: /select bond7 250ml/i });
    const checkbox2 = screen.getByRole("checkbox", { name: /select c. mogan250ml/i });

    // Initial state: select all is unchecked and not indeterminate
    expect(selectAllCheckbox.checked).toBe(false);
    expect(selectAllCheckbox.indeterminate).toBe(false);

    // Select two items (out of 3)
    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);

    // Header checkbox must remain unchecked and must NOT get a dash (indeterminate = false)
    expect(selectAllCheckbox.checked).toBe(false);
    expect(selectAllCheckbox.indeterminate).toBe(false);

    // Select the third item (all selected)
    const checkbox3 = screen.getByRole("checkbox", { name: /select tusker lager 500ml/i });
    fireEvent.click(checkbox3);

    // Now all are selected: select all is checked, not indeterminate
    expect(selectAllCheckbox.checked).toBe(true);
    expect(selectAllCheckbox.indeterminate).toBe(false);
  });

  it("hides 'Set to today' button when date is already today, shows it on different dates, and hides it when clicked", async () => {
    wrap(<GoodsReceiptPage initialOrgId="org-1" initialBranchId="branch-1" />);

    await waitFor(() => {
      expect(screen.getByText("Guinness bottle")).toBeInTheDocument();
    });

    // Open Add Stock slide-over
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add stock" })).toBeInTheDocument();
    });

    // Date is today by default, so 'Set to today' button must be hidden
    expect(screen.queryByRole("button", { name: /set to today/i })).not.toBeInTheDocument();

    // Change date to 5 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const dateInput = screen.getByLabelText(/received at/i);
    fireEvent.change(dateInput, { target: { value: formatDateInput(pastDate) } });

    // Now 'Set to today' button must be visible
    const setTodayBtn = screen.getByRole("button", { name: /set to today/i });
    expect(setTodayBtn).toBeInTheDocument();

    // Click 'Set to today' -> date reverts to today and button is hidden again
    fireEvent.click(setTodayBtn);
    expect(screen.queryByRole("button", { name: /set to today/i })).not.toBeInTheDocument();
    expect(dateInput).toHaveValue(formatDateInput(new Date()));
  });
});



