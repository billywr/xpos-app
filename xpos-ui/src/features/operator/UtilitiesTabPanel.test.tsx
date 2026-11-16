import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { UtilitiesTabPanel } from "./UtilitiesTabPanel";
import * as recurringApi from "@/api/recurringUtilities";

vi.mock("@/api/recurringUtilities");

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
        username: "operator",
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

describe("UtilitiesTabPanel", () => {
  beforeEach(() => {
    vi.mocked(recurringApi.fetchRecurringUtilities).mockResolvedValue({
      items: [
        {
          id: "util-1",
          orgId: "org-1",
          branchId: "branch-1",
          name: "Rent",
          amount: 50000,
          applyTiming: "BEGINNING_OF_MONTH",
          dueDayOfMonth: 1,
          payee: "Plaza Management",
          accountNumber: "PLZ-001",
          incurredBy: "Manager",
          notes: "Advance rent for shop floor",
          active: true,
          createdByStaffUserId: "user-1",
          createdByStaffUserName: "operator",
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
        },
        {
          id: "util-2",
          orgId: "org-1",
          branchId: "branch-1",
          name: "Electricity (KPLC)",
          amount: 12000,
          applyTiming: "END_OF_MONTH",
          dueDayOfMonth: 28,
          payee: "Kenya Power",
          accountNumber: "MTR-88291",
          incurredBy: "Manager",
          notes: "Postpaid power meter",
          active: true,
          createdByStaffUserId: "user-1",
          createdByStaffUserName: "operator",
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
        },
      ],
      page: 0,
      size: 50,
      totalElements: 2,
      totalPages: 1,
    });

    vi.mocked(recurringApi.fetchRecurringUtilitySummary).mockResolvedValue({
      activeCount: 2,
      monthlyTotalAmount: 62000,
    });
  });

  it("renders utilities table with deduction timing badges and monthly summary", async () => {
    wrap(
      <UtilitiesTabPanel
        orgId="org-1"
        branchId="branch-1"
        branchName="Main Branch"
        isCreateOpen={false}
        setIsCreateOpen={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Rent")).toBeInTheDocument();
      expect(screen.getByText("Electricity (KPLC)")).toBeInTheDocument();
    });

    // Deduction timing badges
    expect(screen.getByText(/Beginning of month \(1st\)/)).toBeInTheDocument();
    expect(screen.getByText(/End of month \(Last day\)/)).toBeInTheDocument();

    // Summary chip
    expect(screen.getByText(/KSH 62,000/)).toBeInTheDocument();

    // Verify removed columns are absent
    expect(screen.queryByText("Due Day")).not.toBeInTheDocument();
    expect(screen.queryByText("Payee / Vendor")).not.toBeInTheDocument();
    expect(screen.queryByText("Account / Ref")).not.toBeInTheDocument();
    expect(screen.queryByText("Managed By")).not.toBeInTheDocument();
  });

  it("supports adding and deleting utility presets right from the dropdown", async () => {
    wrap(
      <UtilitiesTabPanel
        orgId="org-1"
        branchId="branch-1"
        branchName="Main Branch"
        isCreateOpen={true}
        setIsCreateOpen={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Add recurring utility")).toBeInTheDocument();
    });

    const combobox = screen.getByPlaceholderText(
      "Select preset or type custom utility name..."
    );
    expect(combobox).toBeInTheDocument();
    fireEvent.focus(combobox);

    // Delete DSTV / TV Subscription preset from the dropdown
    const deleteDstvBtn = screen.getByRole("button", { name: "Delete DSTV / TV Subscription" });
    expect(deleteDstvBtn).toBeInTheDocument();
    fireEvent.click(deleteDstvBtn);

    // DSTV should now be removed from options
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Delete DSTV / TV Subscription" })).not.toBeInTheDocument();
    });

    // Add a new utility preset via the bottom input in the dropdown
    const addInput = screen.getByPlaceholderText("New utility name...");
    fireEvent.change(addInput, { target: { value: "Solar Battery Maintenance" } });
    const addBtn = screen.getByRole("button", { name: /Add$/i });
    fireEvent.click(addBtn);

    // Form value should now be set to "Solar Battery Maintenance"
    expect(combobox).toHaveValue("Solar Battery Maintenance");
  });
});
