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
import { StandardStockCountSheetPage } from "./StandardStockCountSheetPage";
import * as stdApi from "@/api/stdStockCount";
import * as debtsApi from "@/api/debts";
import * as analyticsApi from "@/api/operatorAnalytics";

vi.mock("@/api/stdStockCount");
vi.mock("@/api/debts");
vi.mock("@/api/operatorAnalytics");

function wrap(component: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      orgContext: orgContextReducer,
      cart: cartReducer,
    },
    preloadedState: {
      auth: {
        token: "t",
        iamUserId: "u",
        username: null,
        expiresAt: null,
        refreshToken: null,
        roles: [],
      },
      orgContext: {
        orgId: "org-1",
        orgName: "Acme",
        branchId: "branch-1",
        branchName: "Main",
        terminalId: null,
        terminalName: null,
      },
    },
  });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <ToastProvider>{component}</ToastProvider>
        </QueryClientProvider>
      </Provider>
    </MemoryRouter>
  );
}

describe("StandardStockCountSheetPage filter", () => {
  beforeEach(() => {
    const rows = Array.from({ length: 73 }, (_, i) => ({
      itemId: `item-${i + 1}`,
      sku: `SKU${String(i + 1).padStart(3, "0")}`,
      name: `Product ${i + 1}`,
      openingStock: 10,
      addedStock: 0,
      addedTodayStock: 0,
      sellingPrice: 100,
      closingStock: null,
      lastSavedAt: null,
      comments: null,
    }));
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: "2026-04-18",
      outletId: "branch-1",
      rows,
    });
    vi.mocked(debtsApi.fetchDebts).mockResolvedValue([] as never);
    vi.mocked(analyticsApi.fetchOperatorAnalyticsSnapshot).mockResolvedValue({
      expenseIntelligence: { todayTotal: 0 },
    } as never);
  });

  it("filter finds item on a later page when viewing page 1", async () => {
    wrap(<StandardStockCountSheetPage />);

    // Wait for data to load — first page shows Products 1..25
    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Product 50")).not.toBeInTheDocument();

    // Type a search that only matches a row on page 2
    const input = screen.getByPlaceholderText(/filter by name or sku/i);
    fireEvent.change(input, { target: { value: "Product 50" } });

    // After filtering, the match should appear even though it was on page 2
    await waitFor(() => {
      expect(screen.getByText("Product 50")).toBeInTheDocument();
    });
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
  });

  it("filter by SKU finds item on a later page", async () => {
    wrap(<StandardStockCountSheetPage />);
    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/filter by name or sku/i);
    fireEvent.change(input, { target: { value: "SKU072" } });

    await waitFor(() => {
      expect(screen.getByText("Product 72")).toBeInTheDocument();
    });
  });
});
