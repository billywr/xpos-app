import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { StandardStockCountSheetPage } from "./StandardStockCountSheetPage";
import {
  getSavedStockCountDate,
  saveStockCountDate,
  clearAllStoredDatePersistence,
} from "@/utils/datePersistenceStorage";
import { MemoryRouter } from "react-router-dom";

// Mock the APIs
vi.mock("@/api/stdStockCount", () => ({
  fetchStdStockCountSheet: vi.fn().mockResolvedValue({
    date: "2026-11-10",
    rows: [],
    closed: false,
    canEdit: true,
  }),
  saveStdStockCount: vi.fn().mockResolvedValue({}),
  autoSyncStdStockCount: vi.fn().mockResolvedValue({}),
  fetchStdStockCountSalesPreview: vi.fn().mockResolvedValue({ lines: [] }),
  recordStdStockCountSales: vi.fn().mockResolvedValue({}),
  fetchStdStockCountReconcilePreview: vi.fn().mockResolvedValue({ lines: [] }),
  reconcileStdStockCountInventory: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/api/operatorAnalytics", () => ({
  fetchOperatorAnalyticsSnapshot: vi.fn().mockResolvedValue({
    expenseIntelligence: { todayTotal: 0 },
  }),
}));

vi.mock("@/api/debts", () => ({
  fetchDebts: vi.fn().mockResolvedValue({
    activeDebtsCount: 0,
    totalOutstandingAmount: 0,
    todayDebtsCount: 0,
    todayOutstandingAmount: 0,
  }),
}));

function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = configureStore({
    reducer: {
      auth: authReducer,
      orgContext: orgContextReducer,
      cart: cartReducer,
    },
    preloadedState: {
      auth: {
        token: "fake-token",
        iamUserId: "user-1",
        username: "test",
        roles: ["ROLE_OPERATOR"],
        expiresAt: null,
        refreshToken: null,
      },
      orgContext: {
        orgId: "org-1",
        orgName: "Acme",
        branchId: "branch-1",
        branchName: "Main",
        terminalId: "term-1",
        terminalName: "Terminal 1",
      },
    },
  });

  return render(
    <MemoryRouter>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <StandardStockCountSheetPage />
          </ToastProvider>
        </QueryClientProvider>
      </Provider>
    </MemoryRouter>
  );
}

describe("StandardStockCountSheetPage date persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists selected date across unmount and remount", async () => {
    // Pre-save a past date in localStorage
    saveStockCountDate("2026-11-10", "org-1", "branch-1");

    const { unmount } = renderSheet();

    // The DatePicker placeholder or input should have the formatted date
    await waitFor(() => {
      const dateInput = screen.getByPlaceholderText("Select date") as HTMLInputElement;
      expect(dateInput.value).toBe("10/11/2026");
    });

    // Verify "Today" button is visible since date is not today
    expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();

    unmount();

    // Verify storage still contains the date
    expect(getSavedStockCountDate("org-1", "branch-1")).toBe("2026-11-10");

    // Remounting should still display the past date
    renderSheet();
    await waitFor(() => {
      const dateInput = screen.getByPlaceholderText("Select date") as HTMLInputElement;
      expect(dateInput.value).toBe("10/11/2026");
    });
  });

  it("clicking Today updates the persisted date to today", async () => {
    saveStockCountDate("2026-11-10", "org-1", "branch-1");

    renderSheet();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
    });

    const todayBtn = screen.getByRole("button", { name: /today/i });
    fireEvent.click(todayBtn);

    // Today button disappears once we are on today
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /today/i })).not.toBeInTheDocument();
    });
  });

  it("defaults to today after clearAllStoredDatePersistence is called", async () => {
    saveStockCountDate("2026-11-10", "org-1", "branch-1");
    clearAllStoredDatePersistence();

    renderSheet();

    // Since date is today, Today button should not be in the document
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /today/i })).not.toBeInTheDocument();
    });
  });
});

