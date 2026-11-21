import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { NavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { AdminSettingsPage } from "./AdminSettingsPage";

// Mock MpesaSettingsSection to isolate AdminSettingsPage unit tests
vi.mock("@/features/admin/MpesaSettingsSection", () => ({
  MpesaSettingsSection: () => (
    <section>
      <h2>M-Pesa Settings</h2>
      <p>Configure Safaricom Daraja M-PESA STK Push</p>
    </section>
  ),
}));

// Mock assistant API
vi.mock("@/api/assistant", () => ({
  fetchAssistantSettings: vi.fn().mockResolvedValue({
    llmConfigured: true,
    llmEnabled: true,
    model: "gemini-flash",
    maxTokensPerDayPerOrg: 50000,
  }),
  fetchAssistantUsage: vi.fn().mockResolvedValue({
    totalQueries: 42,
    llmTokensUsed: 12000,
    topIntents: [{ intent: "sales_summary", count: 25 }],
  }),
}));

const mockContextValue = {
  adminVisibility: {},
  operatorVisibility: {},
  headerVisibility: {},
  adminLabels: {},
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
  getAdminLabel: (_path: string, def: string) => def,
  getOperatorLabel: (_path: string, def: string) => def,
  getHeaderLabel: (_path: string, def: string) => def,
  getHeaderLogo: () => null,
  setHeaderLogo: vi.fn(),
  darkTheme: "petrol",
  setDarkTheme: vi.fn(),
  isLoading: false,
  isSaving: false,
  needsOrgSelection: false,
};

function renderSettingsPage(initialEntries = ["/admin/settings"]) {
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
        roles: ["ADMIN"],
      },
      orgContext: {
        orgId: "org-123",
        branchId: "branch-123",
        terminalId: "term-123",
        orgName: "Test Org",
        branchName: "Main Branch",
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
          <NavVisibilityContext.Provider value={mockContextValue}>
            <MemoryRouter initialEntries={initialEntries}>
              <Routes>
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
              </Routes>
            </MemoryRouter>
          </NavVisibilityContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all settings tabs with Top Bar active by default", () => {
    renderSettingsPage();

    expect(screen.getByRole("tab", { name: /top bar/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /admin sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /operator sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /pos & features/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /m-pesa/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /forms & sheets/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /appearance/i })).toBeInTheDocument();

    // Default tab is Top Bar
    expect(screen.getByText("Top navigation bar")).toBeInTheDocument();
    expect(screen.queryByText("Admin sidebar")).not.toBeInTheDocument();
  });

  it("switches tabs when tab buttons are clicked", () => {
    renderSettingsPage();

    // Switch to Admin Sidebar tab
    fireEvent.click(screen.getByRole("tab", { name: /admin sidebar/i }));
    expect(screen.getByText("Admin sidebar")).toBeInTheDocument();
    expect(screen.queryByText("Top navigation bar")).not.toBeInTheDocument();

    // Switch to POS & Features tab
    fireEvent.click(screen.getByRole("tab", { name: /pos & features/i }));
    expect(screen.getByText("POS (operator)")).toBeInTheDocument();
    expect(screen.getByText("Standard stock count")).toBeInTheDocument();
    expect(screen.getByText("Barcode (per screen)")).toBeInTheDocument();

    // Switch to Forms & Sheets tab
    fireEvent.click(screen.getByRole("tab", { name: /forms & sheets/i }));
    expect(screen.getByText("Form & Sheet Customization")).toBeInTheDocument();

    // Switch to Appearance tab
    fireEvent.click(screen.getByRole("tab", { name: /appearance/i }));
    expect(screen.getByText("Dark Mode Theme")).toBeInTheDocument();
  });

  it("reads tab from URL query param", () => {
    renderSettingsPage(["/admin/settings?tab=appearance"]);

    expect(screen.getByText("Dark Mode Theme")).toBeInTheDocument();
    expect(screen.queryByText("Top navigation bar")).not.toBeInTheDocument();
  });

  it("reads forms tab from URL query param", () => {
    renderSettingsPage(["/admin/settings?tab=forms"]);

    expect(screen.getByText("Form & Sheet Customization")).toBeInTheDocument();
    expect(screen.queryByText("Top navigation bar")).not.toBeInTheDocument();
  });

  it("filters sections across all tabs when searching", () => {
    renderSettingsPage();

    const searchInput = screen.getByRole("textbox", { name: /search sections or settings/i });
    fireEvent.change(searchInput, { target: { value: "barcode" } });

    // Should show results banner
    expect(screen.getByText(/matching/i)).toBeInTheDocument();

    // Should display the Barcode section and its parent tab badge
    expect(screen.getByText("Barcode (per screen)")).toBeInTheDocument();
    expect(screen.getByText("Tab: POS & Features")).toBeInTheDocument();

    // Top Bar shouldn't be shown since it doesn't match
    expect(screen.queryByText("Top navigation bar")).not.toBeInTheDocument();
  });

  it("navigates to tab and clears search when clicking 'Go to tab'", () => {
    renderSettingsPage();

    const searchInput = screen.getByRole("textbox", { name: /search sections or settings/i });
    fireEvent.change(searchInput, { target: { value: "theme" } });

    expect(screen.getByText("Dark Mode Theme")).toBeInTheDocument();
    const goToTabBtn = screen.getByRole("button", { name: /go to tab/i });
    fireEvent.click(goToTabBtn);

    // Search query should be cleared and Appearance tab should be active
    expect(searchInput).toHaveValue("");
    expect(screen.getByText("Dark Mode Theme")).toBeInTheDocument();
    expect(screen.queryByText(/matching/i)).not.toBeInTheDocument();
  });

  it("clears search using clear search button in header", () => {
    renderSettingsPage();

    const searchInput = screen.getByRole("textbox", { name: /search sections or settings/i });
    fireEvent.change(searchInput, { target: { value: "operator" } });

    expect(screen.getByText(/matching/i)).toBeInTheDocument();

    // Click input clear X button
    const clearXBtn = screen.getAllByRole("button", { name: "Clear search" })[0];
    fireEvent.click(clearXBtn);

    expect(searchInput).toHaveValue("");
    expect(screen.queryByText(/matching/i)).not.toBeInTheDocument();
    // Default top bar visible again
    expect(screen.getByText("Top navigation bar")).toBeInTheDocument();
  });

  it("shows empty state when no sections match search query", () => {
    renderSettingsPage();

    const searchInput = screen.getByRole("textbox", { name: /search sections or settings/i });
    fireEvent.change(searchInput, { target: { value: "nonexistentquery12345" } });

    expect(screen.getByText("No settings sections found")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /clear search/i }).length).toBeGreaterThan(0);
  });

  it("renders Stock receiving settings under POS & Features and updates max quantity presets", () => {
    renderSettingsPage(["/admin/settings?tab=pos"]);

    expect(screen.getByRole("heading", { name: "Stock receiving (Add stock)" })).toBeInTheDocument();
    expect(screen.getByText(/limit quantities when adding stock/i)).toBeInTheDocument();

    // Verify preset buttons exist
    const preset100 = screen.getByRole("button", { name: "100" });
    const preset200 = screen.getByRole("button", { name: "200" });
    expect(preset100).toBeInTheDocument();
    expect(preset200).toBeInTheDocument();

    // Click 100 preset
    fireEvent.click(preset100);
    expect(mockContextValue.setAdminLabel).toHaveBeenCalledWith(
      "admin.goods_receipt.max_qty",
      "100"
    );

    // Click 200 preset
    fireEvent.click(preset200);
    expect(mockContextValue.setAdminLabel).toHaveBeenCalledWith(
      "admin.goods_receipt.max_qty",
      "200"
    );

    // Test custom max quantity input
    const maxQtyInput = screen.getByLabelText(/maximum stock receiving quantity/i);
    fireEvent.change(maxQtyInput, { target: { value: "150" } });
    expect(mockContextValue.setAdminLabel).toHaveBeenCalledWith(
      "admin.goods_receipt.max_qty",
      "150"
    );

    // Verify Show max limit badge toggle
    expect(screen.getByText("Show max limit badge in Add stock")).toBeInTheDocument();
    const showLimitCheckbox = screen.getByLabelText("Show max limit badge in Add stock");
    expect(showLimitCheckbox).not.toBeChecked();
    fireEvent.click(showLimitCheckbox);
    expect(mockContextValue.setAdminLabel).toHaveBeenCalledWith(
      "admin.goods_receipt.show_limit",
      "true"
    );

    // Verify Limit to whole digits only toggle has Enabled/Disabled text (not Hidden)
    expect(screen.getByText("Limit to whole digits only")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    const digitsCheckbox = screen.getByLabelText("Limit to whole digits only");
    expect(digitsCheckbox).toBeChecked();
    fireEvent.click(digitsCheckbox);
    expect(mockContextValue.setAdminLabel).toHaveBeenCalledWith(
      "admin.goods_receipt.digits_only",
      "false"
    );
  });

  it("renders Toast notifications settings under Appearance tab and toggles show action time in toasts", () => {
    renderSettingsPage(["/admin/settings?tab=appearance"]);

    expect(screen.getByRole("heading", { name: "Toast notifications" })).toBeInTheDocument();
    expect(screen.getByText(/show action time in toasts/i)).toBeInTheDocument();

    const checkbox = screen.getByLabelText(/show action time in toasts/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(mockContextValue.setAdminLabel).toHaveBeenCalledWith(
      "ui.toast.show_time",
      "false"
    );
  });
});

