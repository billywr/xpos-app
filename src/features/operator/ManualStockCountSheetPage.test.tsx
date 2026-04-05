import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { ManualStockCountSheetPage } from "./ManualStockCountSheetPage";
import * as manualApi from "@/api/manualStockCount";

vi.mock("@/api/manualStockCount");

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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{component}</ToastProvider>
        </QueryClientProvider>
      </Provider>
    </MemoryRouter>
  );
}

describe("ManualStockCountSheetPage", () => {
  beforeEach(() => {
    vi.mocked(manualApi.fetchManualStockCountSheet).mockImplementation(
      async (_token, _orgId, _branchId, date) => ({
        date,
        outletId: "branch-1",
        lastSavedAt: null,
        rows: [],
      })
    );
  });

  it("renders empty sheet message after load", async () => {
    wrap(<ManualStockCountSheetPage />);
    await waitFor(() => {
      expect(screen.getByText(/No lines yet/)).toBeInTheDocument();
    });
  });
});
