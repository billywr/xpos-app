import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import {
  TableCustomizationContext,
  type TableCustomizationContextValue,
  type TableDensity,
} from "@/contexts/TableCustomizationContext";
import { StaffListPage } from "./StaffListPage";
import * as staffUsersApi from "@/api/staffUsers";
import * as orgsApi from "@/api/orgs";

vi.mock("@/api/staffUsers");
vi.mock("@/api/orgs");

describe("StaffListPage with Table Customization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  function wrapWithCustomContext(
    component: React.ReactElement,
    tableCtx: TableCustomizationContextValue
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
          username: null,
          expiresAt: null,
          refreshToken: null,
          roles: [],
        },
        orgContext: {
          orgId: "org-1",
          branchId: "branch-1",
          terminalId: "term-1",
          orgName: "Org 1",
          branchName: "Branch 1",
          terminalName: "POS 1",
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
            <TableCustomizationContext.Provider value={tableCtx}>
              <MemoryRouter>{component}</MemoryRouter>
            </TableCustomizationContext.Provider>
          </ToastProvider>
        </QueryClientProvider>
      </Provider>
    );
  }

  it("renders custom column labels and respects table customization order in staff table", async () => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [{ id: "org-1", name: "Org 1", status: "ACTIVE" }],
      totalPages: 1,
      totalElements: 1,
    } as any);

    vi.mocked(staffUsersApi.fetchStaffUsers).mockResolvedValue({
      content: [
        {
          id: "staff-1",
          orgId: "org-1",
          iamUserId: "iam-1",
          username: "cashier_alice",
          status: "ACTIVE",
          createdAt: "2026-11-20T10:00:00Z",
          updatedAt: "2026-11-20T10:00:00Z",
        },
      ],
      totalPages: 1,
      totalElements: 1,
      size: 25,
      number: 0,
    } as any);

    const mockTableCtx: TableCustomizationContextValue = {
      getTableConfig: vi.fn(() => [
        {
          key: "username",
          label: "Cashier Handle",
          defaultLabel: "Username",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 1,
          defaultOrder: 1,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "status",
          label: "Account State",
          defaultLabel: "Status",
          visible: true,
          defaultVisible: true,
          canHide: true,
          order: 2,
          defaultOrder: 2,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "actions",
          label: "Manage Staff",
          defaultLabel: "Actions",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 3,
          defaultOrder: 3,
          align: "left" as const,
          sortable: false,
        },
      ]),
      getVisibleColumns: vi.fn(() => [
        {
          key: "username",
          label: "Cashier Handle",
          defaultLabel: "Username",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 1,
          defaultOrder: 1,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "status",
          label: "Account State",
          defaultLabel: "Status",
          visible: true,
          defaultVisible: true,
          canHide: true,
          order: 2,
          defaultOrder: 2,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "actions",
          label: "Manage Staff",
          defaultLabel: "Actions",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 3,
          defaultOrder: 3,
          align: "left" as const,
          sortable: false,
        },
      ]),
      isColumnVisible: vi.fn((_t, col) => col === "username" || col === "status" || col === "actions"),
      getColumnLabel: vi.fn((_t, col) =>
        col === "username" ? "Cashier Handle" : col === "status" ? "Account State" : col
      ),
      getColumnAlign: vi.fn(() => "left" as const),
      getTableDensity: vi.fn(() => "comfortable" as TableDensity),
      getTablePageSize: vi.fn(() => 25),
      getShowRowNumbers: vi.fn(() => true),
      getZebraStriping: vi.fn(() => true),
      setColumnVisibility: vi.fn(),
      setColumnLabel: vi.fn(),
      setColumnAlign: vi.fn(),
      moveColumnOrder: vi.fn(),
      setColumnOrder: vi.fn(),
      setTableDensity: vi.fn(),
      setTablePageSize: vi.fn(),
      setShowRowNumbers: vi.fn(),
      setZebraStriping: vi.fn(),
      resetTableToDefaults: vi.fn(),
      resetAllTablesToDefaults: vi.fn(),
      isSaving: false,
    };

    wrapWithCustomContext(<StaffListPage initialOrgId="org-1" />, mockTableCtx);

    expect(screen.getByText("Cashier handle")).toBeInTheDocument();
    expect(screen.getByText("Account state")).toBeInTheDocument();
    expect(screen.getByText("Manage staff")).toBeInTheDocument();
    expect(screen.getByText("No.")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("cashier_alice")).toBeInTheDocument();
    });
  });
});
