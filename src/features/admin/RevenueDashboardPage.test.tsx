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

vi.mock("@/api/orgs");
vi.mock("@/api/branches");
vi.mock("@/api/revenueDashboard");

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
        saleCount: 42,
      },
      trend: [
        {
          date: "2025-01-15",
          revenue: 50000,
          tax: 7500,
          cogs: 20000,
          saleCount: 15,
        },
        {
          date: "2025-01-16",
          revenue: 52000,
          tax: 7800,
          cogs: 21000,
          saleCount: 16,
        },
      ],
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
});
