import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { OrgsListPage } from "./OrgsListPage";
import * as orgsApi from "@/api/orgs";

vi.mock("@/api/orgs");

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
        <ToastProvider>
          {component}
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}

describe("OrgsListPage", () => {
  beforeEach(() => {
    vi.mocked(orgsApi.fetchOrgs).mockReset();
  });

  it("shows loading then list of organizations when fetch succeeds", async () => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [
        {
          id: "org-1",
          name: "Acme Corp",
          status: "ACTIVE",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 25,
      number: 0,
      first: true,
      last: true,
    });

    wrap(<OrgsListPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.getByText(/1 organization\(s\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add organization/i })).toBeInTheDocument();
  });

  it("shows user-friendly error and requestId when fetch fails (e.g. network)", async () => {
    vi.mocked(orgsApi.fetchOrgs).mockRejectedValue({
      status: 0,
      data: {
        timestamp: new Date().toISOString(),
        status: 0,
        error: "NETWORK_ERROR",
        code: "NETWORK_ERROR",
        message:
          "Cannot reach server. Check that the backend is running and VITE_API_BASE_URL is correct.",
        path: "/api/v1/admin/orgs",
        requestId: "req-ref-123",
      },
    });

    wrap(<OrgsListPage />);

    await waitFor(() => {
      expect(screen.getByText(/Cannot reach server/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Reference:/)).toBeInTheDocument();
    expect(screen.getByText("req-ref-123")).toBeInTheDocument();
  });

  it("shows empty state when fetch succeeds with no orgs", async () => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 25,
      number: 0,
      first: true,
      last: true,
    });

    wrap(<OrgsListPage />);

    await waitFor(() => {
      expect(screen.getByText(/No organizations yet/)).toBeInTheDocument();
    });
  });
});
