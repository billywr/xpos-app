import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ROLE_ADMIN, ROLE_OPERATOR } from "@/store/selectors/authSelectors";
import { NavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Layout } from "./Layout";

vi.mock("@/components/ContextSelectDropdowns", () => ({
  ContextSelectDropdowns: () => <div data-testid="context-select-dropdowns" />,
}));

vi.mock("@/components/ServerConfigModal", () => ({
  ServerConfigModal: () => null,
}));

vi.mock("@/components/ui/PageTransition", () => ({
  PageTransition: () => <div data-testid="page-transition" />,
}));

vi.mock("@/hooks/useActiveOrgs", () => ({
  useActiveOrgs: () => ({ orgs: [{ id: "org-1", name: "Stone Pub" }] }),
}));

describe("Layout - Top Navigation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function renderLayout({
    roles = [ROLE_ADMIN],
    initialPath = "/admin",
    headerLabels = {} as Record<string, string>,
    headerVisibility = {} as Record<string, boolean>,
  } = {}) {
    const store = configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
        cart: cartReducer,
      },
      preloadedState: {
        auth: {
          token: "valid-token",
          iamUserId: "user-1",
          username: "billy",
          expiresAt: null,
          refreshToken: null,
          roles,
        },
        orgContext: {
          orgId: "org-1",
          branchId: "branch-1",
          terminalId: "term-1",
          orgName: "stone pub",
          branchName: "stone pub branch",
          terminalName: "T1",
        },
      },
    });

    const mockNavContext: any = {
      adminVisibility: {},
      operatorVisibility: {},
      headerVisibility,
      adminLabels: {},
      operatorLabels: {},
      headerLabels,
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
      getAdminLabel: (_p: string, d: string) => d,
      getOperatorLabel: (_p: string, d: string) => d,
      getHeaderLabel: (p: string, d: string) => headerLabels[p]?.trim() || d,
      getHeaderLogo: () => null,
      setHeaderLogo: vi.fn(),
      darkTheme: "ocean",
      setDarkTheme: vi.fn(),
      isLoading: false,
      isSaving: false,
      needsOrgSelection: false,
    };

    return render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <NavVisibilityContext.Provider value={mockNavContext}>
            <ThemeProvider>
              <MemoryRouter initialEntries={[initialPath]}>
                <Layout />
              </MemoryRouter>
            </ThemeProvider>
          </NavVisibilityContext.Provider>
        </QueryClientProvider>
      </Provider>
    );
  }

  it("renders POS link next to Operator / Counter", () => {
    renderLayout({
      roles: [ROLE_ADMIN],
      headerLabels: { "/operator": "Counter" },
    });

    // Check Counter and POS are rendered
    const counterLinks = screen.getAllByRole("link", { name: "Counter" });
    const posLinks = screen.getAllByRole("link", { name: "POS" });

    expect(counterLinks.length).toBeGreaterThan(0);
    expect(posLinks.length).toBeGreaterThan(0);

    // Verify link destinations
    expect(posLinks[0]).toHaveAttribute("href", "/operator/menu-order");
    expect(counterLinks[0]).toHaveAttribute("href", "/operator");
  });

  it("highlights Admin when on /admin, not Counter or POS", () => {
    renderLayout({
      roles: [ROLE_ADMIN],
      initialPath: "/admin",
      headerLabels: { "/operator": "Counter" },
    });

    const adminLinks = screen.getAllByRole("link", { name: "Admin" });
    const counterLinks = screen.getAllByRole("link", { name: "Counter" });
    const posLinks = screen.getAllByRole("link", { name: "POS" });

    expect(adminLinks[0].className).toContain("bg-primary-600");
    expect(counterLinks[0].className).not.toContain("bg-primary-600");
    expect(posLinks[0].className).not.toContain("bg-primary-600");
  });

  it("highlights Counter when on /operator, and does not highlight POS", () => {
    renderLayout({
      roles: [ROLE_ADMIN],
      initialPath: "/operator",
      headerLabels: { "/operator": "Counter" },
    });

    const counterLinks = screen.getAllByRole("link", { name: "Counter" });
    const posLinks = screen.getAllByRole("link", { name: "POS" });

    expect(counterLinks[0].className).toContain("bg-primary-600");
    expect(posLinks[0].className).not.toContain("bg-primary-600");
  });

  it("highlights POS when on /operator/menu-order, and does not highlight Counter", () => {
    renderLayout({
      roles: [ROLE_ADMIN],
      initialPath: "/operator/menu-order",
      headerLabels: { "/operator": "Counter" },
    });

    const counterLinks = screen.getAllByRole("link", { name: "Counter" });
    const posLinks = screen.getAllByRole("link", { name: "POS" });

    expect(posLinks[0].className).toContain("bg-primary-600");
    expect(counterLinks[0].className).not.toContain("bg-primary-600");
  });

  it("highlights POS when on /admin/pos", () => {
    renderLayout({
      roles: [ROLE_ADMIN],
      initialPath: "/admin/pos",
      headerLabels: { "/operator": "Counter" },
    });

    const posLinks = screen.getAllByRole("link", { name: "POS" });
    expect(posLinks[0].className).toContain("bg-primary-600");
  });

  it("allows operators to see POS link", () => {
    renderLayout({
      roles: [ROLE_OPERATOR],
      initialPath: "/operator",
    });

    expect(screen.getAllByRole("link", { name: "POS" }).length).toBeGreaterThan(0);
    // Operators cannot see Admin
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("hides POS link if disabled in header visibility settings", () => {
    renderLayout({
      roles: [ROLE_ADMIN],
      headerVisibility: { "/operator/menu-order": false },
    });

    expect(screen.queryByRole("link", { name: "POS" })).not.toBeInTheDocument();
  });
});
