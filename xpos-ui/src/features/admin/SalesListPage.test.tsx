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
import { SalesListPage } from "./SalesListPage";
import * as adminSalesApi from "@/api/adminSales";
import * as orgsApi from "@/api/orgs";
import * as branchesApi from "@/api/branches";

vi.mock("@/api/adminSales");
vi.mock("@/api/orgs");
vi.mock("@/api/branches");

describe("SalesListPage with Table Customization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem(
      "xpos_context",
      JSON.stringify({
        orgId: "org-1",
        orgName: "Org 1",
        branchId: "branch-1",
        branchName: "Branch 1",
        terminalId: "term-1",
        terminalName: "POS 1",
      })
    );
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

  it("renders custom column labels and respects table customization order in sales table", async () => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [{ id: "org-1", name: "Org 1", status: "ACTIVE" }],
      totalPages: 1,
      totalElements: 1,
    } as any);

    vi.mocked(branchesApi.fetchBranches).mockResolvedValue({
      content: [
        { id: "branch-1", orgId: "org-1", name: "Branch 1", code: "B1", status: "ACTIVE", deleted: false },
      ],
      totalPages: 1,
      totalElements: 1,
    } as any);

    vi.mocked(adminSalesApi.fetchAdminSales).mockResolvedValue({
      content: [
        {
          id: "sale-1",
          orgId: "org-1",
          branchId: "branch-1",
          terminalId: "term-1",
          receiptNumber: 1042,
          status: "COMPLETED",
          total: 2500,
          createdByStaffUserId: "staff-1",
          createdByUsername: "kamau_j",
          completedAt: "2026-11-22T10:15:00Z",
          createdAt: "2026-11-22T10:14:00Z",
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
          key: "actions",
          label: "Expand",
          defaultLabel: "Expand",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 1,
          defaultOrder: 1,
          align: "left" as const,
          sortable: false,
        },
        {
          key: "receiptNumber",
          label: "Custom Receipt Voucher",
          defaultLabel: "Receipt #",
          visible: true,
          defaultVisible: true,
          canHide: true,
          order: 2,
          defaultOrder: 2,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "total",
          label: "Sale Total Amount",
          defaultLabel: "Total (KSH)",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 3,
          defaultOrder: 3,
          align: "right" as const,
          sortable: true,
        },
      ]),
      getVisibleColumns: vi.fn(() => [
        {
          key: "actions",
          label: "Expand",
          defaultLabel: "Expand",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 1,
          defaultOrder: 1,
          align: "left" as const,
          sortable: false,
        },
        {
          key: "receiptNumber",
          label: "Custom Receipt Voucher",
          defaultLabel: "Receipt #",
          visible: true,
          defaultVisible: true,
          canHide: true,
          order: 2,
          defaultOrder: 2,
          align: "left" as const,
          sortable: true,
        },
        {
          key: "total",
          label: "Sale Total Amount",
          defaultLabel: "Total (KSH)",
          visible: true,
          defaultVisible: true,
          canHide: false,
          order: 3,
          defaultOrder: 3,
          align: "right" as const,
          sortable: true,
        },
      ]),
      isColumnVisible: vi.fn((_t, col) => col === "actions" || col === "receiptNumber" || col === "total"),
      getColumnLabel: vi.fn((_t, col) =>
        col === "receiptNumber" ? "Custom Receipt Voucher" : col === "total" ? "Sale Total Amount" : col
      ),
      getColumnAlign: vi.fn((_t, col) => (col === "total" ? ("right" as const) : ("left" as const))),
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

    wrapWithCustomContext(
      <SalesListPage initialOrgId="org-1" initialBranchId="branch-1" />,
      mockTableCtx
    );

    expect(screen.getByText("Custom receipt voucher")).toBeInTheDocument();
    expect(screen.getByText("Sale total amount")).toBeInTheDocument();
    expect(screen.getByText("No.")).toBeInTheDocument();

    await waitFor(() => {
      expect(adminSalesApi.fetchAdminSales).toHaveBeenCalled();
      expect(screen.getByText("1042")).toBeInTheDocument();
      expect(screen.getByText("2,500")).toBeInTheDocument();
    });
  });
});
