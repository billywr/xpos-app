import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { RevenueDashboardPage } from "./RevenueDashboardPage";
import * as orgsApi from "@/api/orgs";
import * as branchesApi from "@/api/branches";
import * as revenueApi from "@/api/revenueDashboard";
import * as miscExpensesApi from "@/api/miscExpenses";

vi.mock("@/api/orgs");
vi.mock("@/api/branches");
vi.mock("@/api/revenueDashboard");
vi.mock("@/api/miscExpenses");

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
        <ToastProvider>{component}</ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}

describe("RevenueDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [
        {
          id: "org-1",
          name: "Acme",
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
          status: "ACTIVE",
          timezone: "Africa/Nairobi",
          currency: "KES",
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
    vi.mocked(revenueApi.fetchRevenueDashboard).mockResolvedValue({
      summary: {
        orgId: "org-1",
        branchId: "branch-1",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        revenueTotal: 150000,
        taxTotal: 22500,
        discountTotal: 5000,
        cogsTotal: 60000,
        expenseTotal: 10000,
        netProfit: 80000,
        saleCount: 42,
      },
      trend: [
        {
          date: "2025-01-15",
          revenue: 50000,
          tax: 7500,
          cogs: 20000,
          expenses: 3000,
          netProfit: 27000,
          saleCount: 15,
        },
        {
          date: "2025-01-16",
          revenue: 52000,
          tax: 7800,
          cogs: 21000,
          expenses: 7000,
          netProfit: 24000,
          saleCount: 16,
        },
      ],
    });
    vi.mocked(miscExpensesApi.fetchMiscExpenses).mockResolvedValue({
      content: [
        {
          id: "exp-1",
          amount: 3000,
          category: "Transport",
          description: "Fuel",
          incurredBy: null,
          receiptRef: null,
          terminalId: null,
          shiftId: null,
          createdByStaffUserId: "user-1",
          createdAt: "2025-01-15T10:00:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 500,
      number: 0,
      totalAmount: 10000,
    });
  });

  it("shows Revenue & P&L title and load prompt", async () => {
    wrap(<RevenueDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Revenue & P&L/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Business revenue status/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load dashboard/i })).toBeInTheDocument();
  });

  it("displays Expenses and Net Profit when dashboard is loaded", async () => {
    wrap(<RevenueDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load dashboard/i })).toBeInTheDocument();
    });

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(screen.getByRole("button", { name: /load dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText("Expenses")).toBeInTheDocument();
      expect(screen.getByText("Net profit")).toBeInTheDocument();
    });
  });

  it("automatically adjusts dates when end date is set before start date", async () => {
    wrap(<RevenueDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Revenue & P&L/)).toBeInTheDocument();
    });

    const inputs = screen.getAllByDisplayValue(/20\d\d-\d\d-\d\d/);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const [startInput, endInput] = inputs;

    // Set start date to a future date
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(startInput, { target: { value: "2026-05-20" } });
    fireEvent.change(endInput, { target: { value: "2026-05-10" } });

    // End date was before start date; start date should auto-adjust to match end date
    expect(startInput).toHaveValue("2026-05-10");
    expect(endInput).toHaveValue("2026-05-10");
    expect(screen.getByText(/Date Adjusted/i)).toBeInTheDocument();
  });

  it("keeps filter controls and reports page accessible when API returns an error", async () => {
    vi.mocked(revenueApi.fetchRevenueDashboard).mockRejectedValue(
      new Error("endDate must not be before startDate")
    );

    wrap(<RevenueDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Revenue & P&L/)).toBeInTheDocument();
    });

    // Both the header and load button remain present
    expect(screen.getByRole("button", { name: /load dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Business revenue status/)).toBeInTheDocument();
  });

  it("displays Profit (before expenses) tile alongside Net profit", async () => {
    wrap(<RevenueDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load dashboard/i })).toBeInTheDocument();
    });

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(screen.getByRole("button", { name: /load dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText("Profit")).toBeInTheDocument();
      expect(screen.getByText("Before expenses")).toBeInTheDocument();
      expect(screen.getByText("Net profit")).toBeInTheDocument();
      expect(screen.getByText("Profit - Expenses")).toBeInTheDocument();
    });
  });

  it("opens expense breakdown modal when clicking Expenses card", async () => {
    wrap(<RevenueDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load dashboard/i })).toBeInTheDocument();
    });

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(screen.getByRole("button", { name: /load dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText("Expenses")).toBeInTheDocument();
    });

    // Click Expenses tile to open modal
    const expensesTile = screen.getByTitle(/Click to see breakdown of expenses/i);
    fireEvent.click(expensesTile);

    await waitFor(() => {
      expect(screen.getByText("Expense Breakdown")).toBeInTheDocument();
      expect(screen.getByText("Category Distribution")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search expenses by description/i)).toBeInTheDocument();
    });
  });

  it("changes range when quick preset button is clicked", async () => {
    wrap(<RevenueDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByText("7 Days")).toBeInTheDocument();
      expect(screen.getByText("This Month")).toBeInTheDocument();
    });

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(screen.getByText("Today"));

    // Quick range triggers load dashboard immediately when org and branch are selected
    await waitFor(() => {
      expect(revenueApi.fetchRevenueDashboard).toHaveBeenCalled();
      expect(miscExpensesApi.fetchMiscExpenses).toHaveBeenCalled();
    });
  });
});
