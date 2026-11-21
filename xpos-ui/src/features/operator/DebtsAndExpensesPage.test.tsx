import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { DebtsAndExpensesPage } from "./DebtsAndExpensesPage";

// Mock APIs called by DebtsAndExpensesPage
vi.mock("@/api/debts", () => ({
  fetchDebts: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 1 }),
  fetchGroupedDebts: vi.fn().mockResolvedValue([]),
  createDebt: vi.fn().mockResolvedValue({}),
  updateDebt: vi.fn().mockResolvedValue({}),
  cancelDebt: vi.fn().mockResolvedValue({}),
  settleDebt: vi.fn().mockResolvedValue({}),
  settleCustomerDebtsBulkByName: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/api/miscExpenses", () => ({
  fetchMiscExpenses: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 1 }),
  fetchGroupedExpenses: vi.fn().mockResolvedValue([]),
  fetchExpenseCategories: vi.fn().mockResolvedValue([]),
  createMiscExpense: vi.fn().mockResolvedValue({}),
  updateMiscExpense: vi.fn().mockResolvedValue({}),
  cancelMiscExpense: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/api/me", () => ({
  fetchMe: vi.fn().mockResolvedValue({
    username: "cashier1",
    profile: { displayName: "Cashier One" },
  }),
}));

vi.mock("@/api/items", () => ({
  fetchAllOrgItems: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/api/customers", () => ({
  createCustomer: vi.fn().mockResolvedValue({}),
}));

function renderPage(
  props: Parameters<typeof DebtsAndExpensesPage>[0] = {},
  initialUrl = "/debts"
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
        username: "testuser",
        expiresAt: null,
        refreshToken: null,
        roles: ["OPERATOR"],
      },
      orgContext: {
        orgId: "org-1",
        branchId: "branch-1",
        terminalId: "term-1",
        orgName: "Stone Pub",
        branchName: "Stone Pub Branch",
        terminalName: "T1",
      },
    },
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialUrl]}>
            <DebtsAndExpensesPage {...props} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}

describe("DebtsAndExpensesPage page header and title", () => {
  it("renders page title and header by default for operators", () => {
    renderPage();
    const heading = screen.getByRole("heading", { name: /debts & expenses/i });
    expect(heading).toBeInTheDocument();
  });

  it("hides page header when hideHeader prop is true (e.g. inside admin wrapper)", () => {
    renderPage({ hideHeader: true });
    const heading = screen.queryByRole("heading", { name: /debts & expenses/i });
    expect(heading).not.toBeInTheDocument();
  });

  it("renders page title even when org or branch context is missing", () => {
    renderPage({ orgId: "", branchId: "" });
    const heading = screen.getByRole("heading", { name: /debts & expenses/i });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText(/select organization and branch to manage debts and expenses/i)
    ).toBeInTheDocument();
  });
});

describe("DebtsAndExpensesPage tab persistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("defaults to expenses tab when no query or storage exists", () => {
    renderPage({}, "/debts");
    const expensesTab = screen.getByRole("tab", { name: /expenses/i });
    expect(expensesTab).toHaveAttribute("aria-selected", "true");
  });

  it("opens debts tab when ?tab=debts is in URL", () => {
    renderPage({}, "/debts?tab=debts");
    const debtsTab = screen.getByRole("tab", { name: /debts/i });
    expect(debtsTab).toHaveAttribute("aria-selected", "true");
  });

  it("opens utilities tab when ?tab=utilities is in URL", () => {
    renderPage({}, "/debts?tab=utilities");
    const utilitiesTab = screen.getByRole("tab", { name: /utilities/i });
    expect(utilitiesTab).toHaveAttribute("aria-selected", "true");
  });

  it("switches tabs and updates active state on click", () => {
    renderPage({}, "/debts");
    const debtsTab = screen.getByRole("tab", { name: /debts/i });
    fireEvent.click(debtsTab);
    expect(debtsTab).toHaveAttribute("aria-selected", "true");
    expect(sessionStorage.getItem("xpos-tab:debts-expenses")).toBe("debts");
  });
});

