import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { OrgSetupPage } from "./OrgSetupPage";
import * as orgsApi from "@/api/orgs";
import * as businessesApi from "@/api/businesses";
import * as branchesApi from "@/api/branches";

vi.mock("@/api/orgs");
vi.mock("@/api/businesses");
vi.mock("@/api/branches");

// Mock list subcomponents
vi.mock("./OrgsListPage", () => ({
  OrgsListPage: () => <div data-testid="orgs-panel">Orgs Content</div>,
}));
vi.mock("./BusinessesListPage", () => ({
  BusinessesListPage: () => <div data-testid="businesses-panel">Businesses Content</div>,
}));
vi.mock("./BranchesListPage", () => ({
  BranchesListPage: () => <div data-testid="branches-panel">Branches Content</div>,
}));
vi.mock("./TerminalsListPage", () => ({
  TerminalsListPage: () => <div data-testid="terminals-panel">Terminals Content</div>,
}));
vi.mock("./DevicesListPage", () => ({
  DevicesListPage: () => <div data-testid="devices-panel">Devices Content</div>,
}));
vi.mock("./StaffListPage", () => ({
  StaffListPage: () => <div data-testid="staff-panel">Staff Content</div>,
}));

function renderOrgSetupPage(initialUrl = "/admin/org-setup") {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      orgContext: orgContextReducer,
      cart: cartReducer,
    },
    preloadedState: {
      auth: {
        token: "test-token",
        iamUserId: "admin-1",
        username: "admin",
        expiresAt: null,
        refreshToken: null,
        roles: ["ROLE_ADMIN"],
      },
      orgContext: {
        orgId: "org-1",
        branchId: "branch-1",
        terminalId: null,
        orgName: "Test Org",
        branchName: "Main Branch",
        terminalName: null,
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
        <MemoryRouter initialEntries={[initialUrl]}>
          <OrgSetupPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

describe("OrgSetupPage tab persistence", () => {
  beforeEach(() => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [{ id: "org-1", name: "Org 1", status: "ACTIVE" } as any],
      totalElements: 1,
      totalPages: 1,
      size: 200,
      number: 0,
      first: true,
      last: true,
    });
    vi.mocked(businessesApi.fetchBusinesses).mockResolvedValue({
      content: [{ id: "biz-1", name: "Biz 1" } as any],
      totalElements: 1,
      totalPages: 1,
      size: 1,
      number: 0,
      first: true,
      last: true,
    });
    vi.mocked(branchesApi.fetchBranches).mockResolvedValue({
      content: [{ id: "branch-1", name: "Branch 1" } as any],
      totalElements: 1,
      totalPages: 1,
      size: 1,
      number: 0,
      first: true,
      last: true,
    });
  });

  it("defaults to Organizations tab when URL has no query param", () => {
    renderOrgSetupPage();
    const orgTab = screen.getByRole("tab", { name: /organizations/i });
    expect(orgTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("orgs-panel")).toBeInTheDocument();
  });

  it("reads tab from URL query param when present", () => {
    renderOrgSetupPage("/admin/org-setup?tab=branch");
    const branchTab = screen.getByRole("tab", { name: /branches/i });
    expect(branchTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("branches-panel")).toBeInTheDocument();
  });

  it("switches tabs and persists to storage on click", async () => {
    renderOrgSetupPage();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /businesses/i })).not.toBeDisabled();
    });
    const bizTab = screen.getByRole("tab", { name: /businesses/i });
    fireEvent.click(bizTab);
    expect(bizTab).toHaveAttribute("aria-selected", "true");
    expect(sessionStorage.getItem("xpos-tab:org-setup")).toBe("business");
  });
});
