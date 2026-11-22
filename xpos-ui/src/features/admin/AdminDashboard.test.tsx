import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { AdminDashboard } from "./AdminDashboard";
import * as revenueApi from "@/api/revenueDashboard";
import * as inventoryReportApi from "@/api/inventoryReport";
import * as itemsApi from "@/api/items";
import * as operatorAnalyticsApi from "@/api/operatorAnalytics";
import * as orgsApi from "@/api/orgs";
import * as branchesApi from "@/api/branches";

vi.mock("@/api/revenueDashboard");
vi.mock("@/api/inventoryReport");
vi.mock("@/api/items");
vi.mock("@/api/operatorAnalytics");
vi.mock("@/api/orgs");
vi.mock("@/api/branches");

function renderWithProviders(component: React.ReactElement) {
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
        username: "admin",
        expiresAt: null,
        refreshToken: null,
        roles: ["ROLE_ADMIN"],
      },
      orgContext: {
        orgId: "org-1",
        orgName: "Test Org",
        branchId: "branch-1",
        branchName: "Main Branch",
        terminalId: "term-1",
        terminalName: "POS 1",
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

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [{ id: "org-1", name: "Test Org", status: "ACTIVE" } as any],
      totalElements: 1,
      totalPages: 1,
      size: 20,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(branchesApi.fetchBranches).mockResolvedValue({
      content: [{ id: "branch-1", orgId: "org-1", name: "Main Branch" } as any],
      totalElements: 1,
      totalPages: 1,
      size: 20,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(revenueApi.fetchRevenueDashboard).mockResolvedValue({
      summary: {
        orgId: "org-1",
        branchId: "branch-1",
        startDate: "2026-10-23",
        endDate: "2026-11-22",
        revenueTotal: 150000,
        taxTotal: 24000,
        discountTotal: 5000,
        cogsTotal: 55000,
        expenseTotal: 20000,
        utilitiesTotal: 10000,
        netProfit: 65000,
        saleCount: 85,
      },
      trend: [
        {
          date: "2026-11-20",
          revenue: 50000,
          tax: 8000,
          cogs: 20000,
          expenses: 5000,
          utilities: 2000,
          netProfit: 23000,
          saleCount: 25,
        },
        {
          date: "2026-11-21",
          revenue: 100000,
          tax: 16000,
          cogs: 35000,
          expenses: 15000,
          utilities: 8000,
          netProfit: 42000,
          saleCount: 60,
        },
      ],
    });

    vi.mocked(inventoryReportApi.fetchInventoryReport).mockResolvedValue({
      content: [
        {
          itemId: "item-1",
          itemName: "Premium Coffee Beans",
          sku: "COF-001",
          onHandQty: 4,
          soldQty: 45,
          reservedQty: 0,
          receivedQty: 50,
          trackInventory: true,
        },
        {
          itemId: "item-2",
          itemName: "Green Tea Bags",
          sku: "TEA-002",
          onHandQty: 0,
          soldQty: 30,
          reservedQty: 0,
          receivedQty: 30,
          trackInventory: true,
        },
        {
          itemId: "item-3",
          itemName: "Organic Sugar",
          sku: "SUG-003",
          onHandQty: 50,
          soldQty: 10,
          reservedQty: 0,
          receivedQty: 60,
          trackInventory: true,
        },
      ],
      totalElements: 3,
      totalPages: 1,
      size: 100,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(itemsApi.fetchItems).mockResolvedValue({
      content: [
        {
          id: "item-1",
          orgId: "org-1",
          sku: "COF-001",
          name: "Premium Coffee Beans",
          itemType: "STOCK",
          categoryId: null,
          baseUomId: null,
          taxProfileId: null,
          trackInventory: true,
          active: true,
          visibleInPos: true,
          buyingPrice: 800,
          defaultSellingPrice: 1200,
          primaryImageUrl: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
        {
          id: "item-2",
          orgId: "org-1",
          sku: "TEA-002",
          name: "Green Tea Bags",
          itemType: "STOCK",
          categoryId: null,
          baseUomId: null,
          taxProfileId: null,
          trackInventory: true,
          active: true,
          visibleInPos: true,
          buyingPrice: 300,
          defaultSellingPrice: 500,
          primaryImageUrl: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
        {
          id: "item-3",
          orgId: "org-1",
          sku: "SUG-003",
          name: "Organic Sugar",
          itemType: "STOCK",
          categoryId: null,
          baseUomId: null,
          taxProfileId: null,
          trackInventory: true,
          active: true,
          visibleInPos: true,
          buyingPrice: 150,
          defaultSellingPrice: 250,
          primaryImageUrl: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      totalElements: 3,
      totalPages: 1,
      size: 200,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(operatorAnalyticsApi.fetchOperatorAnalyticsSnapshot).mockResolvedValue({
      businessDate: "2026-11-22",
      fromDate: "2026-10-23",
      toDate: "2026-11-22",
      timezone: "Africa/Nairobi",
      summary: {
        todayRevenue: 150000,
        todaySaleCount: 85,
        todayAvgTicket: 1764.7,
        todayTaxTotal: 24000,
      },
      openShift: { hasOpenShift: true, expectedCashInDrawer: 5000, latestOpenedAt: null },
      hourlyTrend: [],
      topItems: [
        {
          itemId: "item-1",
          itemName: "Premium Coffee Beans",
          totalQty: 45,
          totalRevenue: 54000,
        },
        {
          itemId: "item-2",
          itemName: "Green Tea Bags",
          totalQty: 30,
          totalRevenue: 15000,
        },
      ],
      paymentBreakdown: [],
      last7DaysTrend: [],
      comparison: { previousPeriodRevenue: 120000, percentChange: 25 },
      debtIntelligence: {
        totalOriginal: 0,
        totalRepaid: 0,
        totalOutstanding: 0,
        paymentRatePercent: 100,
        overdueAmount: 0,
        openDebtCount: 0,
        settledDebtCount: 0,
      },
      expenseIntelligence: { todayTotal: 0, byCategory: [] },
      fetchedAt: "2026-11-22T12:00:00Z",
    });
  });

  it("renders executive dashboard title and 4 KPI cards with accurate metrics", async () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText("Executive dashboard")).toBeInTheDocument();

    await waitFor(() => {
      // 1. Net Profit Card
      expect(screen.getByText("Net profit / loss")).toBeInTheDocument();
      expect(screen.getByText("Profitable")).toBeInTheDocument();
      expect(screen.getByText("KSh 65,000")).toBeInTheDocument();

      // 2. Gross Revenue Card
      expect(screen.getByText("Gross revenue")).toBeInTheDocument();
      expect(screen.getByText("KSh 150,000")).toBeInTheDocument();
      expect(screen.getByText("85 sales")).toBeInTheDocument();

      // 3. Total Costs & OpEx Card (appears in KPI card and CostStructureChart donut center)
      expect(screen.getByText("Total costs & opex")).toBeInTheDocument();
      // Total cost = 55000 (cogs) + 20000 (expenses) + 10000 (utilities) = 85000
      expect(screen.getAllByText("KSh 85,000").length).toBe(2);

      // 4. Stock Valuation Card
      expect(screen.getByText("Stock asset valuation")).toBeInTheDocument();
      // item 1: 4 * 800 = 3200; item 2: 0 * 300 = 0; item 3: 50 * 150 = 7500 -> 3200 + 7500 = 10,700
      expect(screen.getByText("KSh 10,700")).toBeInTheDocument();
      expect(screen.getByText("2 items critical")).toBeInTheDocument();
    });
  });

  it("renders the financial trend chart, cost structure chart, and stock health sections", async () => {
    renderWithProviders(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Financial trajectory & profitability")).toBeInTheDocument();
      expect(screen.getByText("Cost & overhead structure")).toBeInTheDocument();
      expect(screen.getByText("Inventory state & restock watchlist")).toBeInTheDocument();
      expect(screen.getByText("Top revenue drivers")).toBeInTheDocument();

      // Check critical replenishment items & top items
      expect(screen.getAllByText("Premium Coffee Beans").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Green Tea Bags").length).toBeGreaterThan(0);
      expect(screen.getByText("Out of stock")).toBeInTheDocument();
      expect(screen.getByText("Low stock")).toBeInTheDocument();
    });
  });


  it("renders all date presets including This Week, Last Week, Last Month, and All", async () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();

    // Clicking "All" updates query with inception date
    const allButton = screen.getByRole("button", { name: "All" });
    fireEvent.click(allButton);

    await waitFor(() => {
      expect(revenueApi.fetchRevenueDashboard).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        "branch-1",
        "2020-01-01",
        expect.any(String)
      );
    });

    // Clicking "Last month" updates query
    const lastMonthButton = screen.getByRole("button", { name: "Last month" });
    fireEvent.click(lastMonthButton);

    await waitFor(() => {
      expect(revenueApi.fetchRevenueDashboard).toHaveBeenCalled();
    });
  });

  it("refetches all dashboard queries when Refresh button is clicked", async () => {
    renderWithProviders(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Refresh/i })).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(revenueApi.fetchRevenueDashboard).toHaveBeenCalled();
      expect(inventoryReportApi.fetchInventoryReport).toHaveBeenCalled();
      expect(itemsApi.fetchItems).toHaveBeenCalled();
      expect(operatorAnalyticsApi.fetchOperatorAnalyticsSnapshot).toHaveBeenCalled();
    });
  });

  it("renders error alert with retry button when API returns an error", async () => {
    vi.mocked(revenueApi.fetchRevenueDashboard).mockRejectedValueOnce(
      new Error("Network timeout")
    );

    renderWithProviders(<AdminDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load some dashboard metrics/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
  });
});
