import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { UtilitiesTabPanel, getUtilityStatus } from "./UtilitiesTabPanel";
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
          effectiveFrom: "2026-10-01",
          effectiveTo: null,
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
          effectiveFrom: undefined as any,
          effectiveTo: null,
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

  it("renders utilities table with deduction timing badges, effective date and monthly summary", async () => {
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

    // Effective from and Effective to table headers and formatted dates
    expect(screen.getByText("Effective from")).toBeInTheDocument();
    expect(screen.getByText("Effective to")).toBeInTheDocument();
    expect(screen.getAllByText("01/10/2026")).toHaveLength(2);

    // Summary chip
    expect(screen.getByText(/KSH 62,000/)).toBeInTheDocument();

    // Verify removed columns are absent
    expect(screen.queryByText("Deduction Timing")).not.toBeInTheDocument();
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

  it("submits create utility with effectiveFrom date", async () => {
    vi.mocked(recurringApi.createRecurringUtility).mockResolvedValue({
      id: "util-3",
      orgId: "org-1",
      branchId: "branch-1",
      name: "Water",
      amount: 3000,
      effectiveFrom: "2026-11-01",
      effectiveTo: null,
      applyTiming: "BEGINNING_OF_MONTH",
      dueDayOfMonth: 1,
      payee: null,
      accountNumber: null,
      incurredBy: null,
      notes: null,
      active: true,
      createdByStaffUserId: "user-1",
      createdByStaffUserName: "operator",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    });

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
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: "Water" } });
    fireEvent.keyDown(combobox, { key: "Enter" });

    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "3000" } });

    const saveBtn = screen.getByRole("button", { name: /^Save$/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(recurringApi.createRecurringUtility).toHaveBeenCalledWith(
        "test-token",
        "org-1",
        "branch-1",
        expect.objectContaining({
          name: "Water Bill",
          amount: 3000,
          effectiveFrom: expect.any(String),
        })
      );
    });
  });

  it("getUtilityStatus correctly classifies active, ended, upcoming, and paused utilities", () => {
    expect(
      getUtilityStatus({
        id: "1",
        active: false,
        name: "Rent",
        amount: 5000,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
      } as any).label
    ).toBe("PAUSED");

    expect(
      getUtilityStatus({
        id: "2",
        active: true,
        name: "Rent",
        amount: 5000,
        effectiveFrom: "2020-01-01",
        effectiveTo: "2020-05-31",
      } as any).label
    ).toBe("ENDED");

    expect(
      getUtilityStatus({
        id: "3",
        active: true,
        name: "Rent",
        amount: 5000,
        effectiveFrom: "2099-01-01",
        effectiveTo: null,
      } as any).label
    ).toBe("UPCOMING");

    expect(
      getUtilityStatus({
        id: "4",
        active: true,
        name: "Rent",
        amount: 5000,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
      } as any).label
    ).toBe("ACTIVE");
  });

  it("enforces min attribute on Effective to month and shows inline error if earlier than from month", async () => {
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

    const monthInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}/);
    // First month input is effectiveFrom (defaults to current month YYYY-MM)
    const effectiveFromInput = monthInputs[0];
    fireEvent.change(effectiveFromInput, { target: { value: "2026-10" } });

    // Effective to input
    const effectiveToInput = screen.getByLabelText(/Effective to/i);
    expect(effectiveToInput).toHaveAttribute("min", "2026-10");

    // If an earlier month is input (e.g. 2026-06 as in user report)
    fireEvent.change(effectiveToInput, { target: { value: "2026-06" } });

    // Inline validation error is rendered
    expect(
      screen.getByText(/Effective to month cannot be earlier than Effective from month/i)
    ).toBeInTheDocument();

    // If user changes effectiveFrom forward to 2026-12, effectiveTo (2026-06) is auto-cleared
    fireEvent.change(effectiveFromInput, { target: { value: "2026-12" } });
    expect(effectiveToInput).toHaveValue("");
    expect(
      screen.queryByText(/Effective to month cannot be earlier than Effective from month/i)
    ).not.toBeInTheDocument();
  });
});
