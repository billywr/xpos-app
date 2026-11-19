import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { useAdminContextSelection } from "./useAdminContextSelection";
import * as orgsApi from "@/api/orgs";
import * as branchesApi from "@/api/branches";
import { setStoredAdminContext, clearStoredContext } from "@/utils/contextStorage";
import type { ReactNode } from "react";

vi.mock("@/api/orgs");
vi.mock("@/api/branches");

describe("useAdminContextSelection", () => {
  let queryClient: QueryClient;

  function createTestStore(initialOrg = "", initialBranch = "") {
    return configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
        cart: cartReducer,
      },
      preloadedState: {
        auth: {
          token: "test-token",
          iamUserId: "user-1",
          username: "admin",
          roles: ["ROLE_ADMIN"],
          expiresAt: Date.now() + 100000,
          refreshToken: null,
        },
        orgContext: {
          orgId: initialOrg,
          orgName: initialOrg ? "Org " + initialOrg : null,
          branchId: initialBranch,
          branchName: initialBranch ? "Branch " + initialBranch : null,
          terminalId: null,
          terminalName: null,
        },
      },
    });
  }

  function createWrapper(store: any) {
    return ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    );
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    clearStoredContext();
    vi.clearAllMocks();

    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [
        { id: "org-1", name: "Stone Pub", status: "ACTIVE" } as any,
        { id: "org-2", name: "Second Pub", status: "ACTIVE" } as any,
      ],
      totalElements: 2,
      totalPages: 1,
      size: 200,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(branchesApi.fetchBranches).mockResolvedValue({
      content: [
        { id: "branch-1", orgId: "org-1", name: "Main Branch", deleted: false } as any,
        { id: "branch-2", orgId: "org-1", name: "Downtown Branch", deleted: false } as any,
      ],
      totalElements: 2,
      totalPages: 1,
      size: 200,
      number: 0,
      first: true,
      last: true,
    });
  });

  it("synchronously initializes orgId and branchId on Frame 0 from stored context", () => {
    setStoredAdminContext({
      orgId: "org-1",
      orgName: "Stone Pub",
      branchId: "branch-2",
      branchName: "Downtown Branch",
    });

    const store = createTestStore();
    const { result } = renderHook(() => useAdminContextSelection(), {
      wrapper: createWrapper(store),
    });

    // Frame 0 assertion: immediately matches stored context without waiting for API
    expect(result.current.selectedOrgId).toBe("org-1");
    expect(result.current.selectedBranchId).toBe("branch-2");
    expect(result.current.isReady).toBe(true);
  });

  it("synchronously initializes from Redux store when present", () => {
    const store = createTestStore("org-2", "branch-99");
    const { result } = renderHook(() => useAdminContextSelection(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.selectedOrgId).toBe("org-2");
    expect(result.current.selectedBranchId).toBe("branch-99");
  });

  it("auto-selects first active org and branch when no stored context exists", async () => {
    const store = createTestStore();
    const { result } = renderHook(() => useAdminContextSelection(), {
      wrapper: createWrapper(store),
    });

    // Initially empty
    expect(result.current.selectedOrgId).toBe("");

    // Once orgs resolves, auto-selects org-1
    await vi.waitFor(() => {
      expect(result.current.selectedOrgId).toBe("org-1");
    });

    // Once branches resolves, auto-selects branch-1
    await vi.waitFor(() => {
      expect(result.current.selectedBranchId).toBe("branch-1");
    });
  });
});
