import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { StandardStockCountSheetPage } from "./StandardStockCountSheetPage";
import * as stdApi from "@/api/stdStockCount";
import * as debtsApi from "@/api/debts";
import * as analyticsApi from "@/api/operatorAnalytics";

vi.mock("@/api/stdStockCount");
vi.mock("@/api/debts");
vi.mock("@/api/operatorAnalytics");

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function localTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function wrap(component: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      orgContext: orgContextReducer,
      cart: cartReducer,
    },
    preloadedState: {
      auth: {
        token: "t",
        iamUserId: "u",
        username: null,
        expiresAt: null,
        refreshToken: null,
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <MemoryRouter>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{component}</ToastProvider>
        </QueryClientProvider>
      </Provider>
    </MemoryRouter>
  );
  return { ...view, queryClient };
}

describe("StandardStockCountSheetPage filter", () => {
  beforeEach(() => {
    vi.mocked(stdApi.saveStdStockCount).mockReset();
    const rows = Array.from({ length: 73 }, (_, i) => ({
      itemId: `item-${i + 1}`,
      sku: `SKU${String(i + 1).padStart(3, "0")}`,
      name: `Product ${i + 1}`,
      openingStock: 0,
      addedStock: 0,
      addedTodayStock: 0,
      sellingPrice: 100,
      closingStock: null,
      lastSavedAt: null,
      comments: null,
    }));
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: "2026-04-18",
      branchId: "branch-1",
      itemsAdjusted: 0,
      itemsAlreadyMatched: 0,
      lines: [],
    });
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: "2026-04-18",
      outletId: "branch-1",
      rows,
    });
    vi.mocked(debtsApi.fetchDebts).mockResolvedValue([] as never);
    vi.mocked(analyticsApi.fetchOperatorAnalyticsSnapshot).mockResolvedValue({
      expenseIntelligence: { todayTotal: 0 },
    } as never);
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: "2026-06-07",
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [],
    });
    vi.mocked(stdApi.recordStdStockCountSales).mockResolvedValue({
      date: "2026-06-07",
      terminalId: "term-1",
      totalItemsRecorded: 0,
      totalValue: 0,
      saleIds: [],
      lines: [],
    });
  });

  it("filter finds item on a later page when viewing page 1", async () => {
    wrap(<StandardStockCountSheetPage />);

    // Wait for data to load — first page shows Products 1..25
    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Product 50")).not.toBeInTheDocument();

    // Type a search that only matches a row on page 2
    const input = screen.getByPlaceholderText(/search all columns/i);
    fireEvent.change(input, { target: { value: "Product 50" } });

    // After filtering, the match should appear even though it was on page 2
    await waitFor(() => {
      expect(screen.getByText("Product 50")).toBeInTheDocument();
    });
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
  });

  it("filter by SKU finds item on a later page", async () => {
    wrap(<StandardStockCountSheetPage />);
    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/search all columns/i);
    fireEvent.change(input, { target: { value: "SKU072" } });

    await waitFor(() => {
      expect(screen.getByText("Product 72")).toBeInTheDocument();
    });
  });

  it("disables Record sales when terminal context is missing", async () => {
    wrap(<StandardStockCountSheetPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /record sales/i })).toBeDisabled();
    });
  });

  it("disables Record sales when preview has no quantities to record", async () => {
    const store = configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
        cart: cartReducer,
      },
      preloadedState: {
        auth: {
          token: "t",
          iamUserId: "u",
          username: null,
          expiresAt: null,
          refreshToken: null,
          roles: [],
        },
        orgContext: {
          orgId: "org-1",
          orgName: "Acme",
          branchId: "branch-1",
          branchName: "Main",
          terminalId: "term-1",
          terminalName: "T1",
        },
      },
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <MemoryRouter>
        <Provider store={store}>
          <QueryClientProvider client={qc}>
            <ToastProvider>
              <StandardStockCountSheetPage />
            </ToastProvider>
          </QueryClientProvider>
        </Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /record sales/i })).toBeDisabled();
    });
    expect(stdApi.fetchStdStockCountSalesPreview).toHaveBeenCalled();
  });

  it("opens preview slide-over with lines to record", async () => {
    const store = configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
        cart: cartReducer,
      },
      preloadedState: {
        auth: {
          token: "t",
          iamUserId: "u",
          username: null,
          expiresAt: null,
          refreshToken: null,
          roles: [],
        },
        orgContext: {
          orgId: "org-1",
          orgName: "Acme",
          branchId: "branch-1",
          branchName: "Main",
          terminalId: "term-1",
          terminalName: "T1",
        },
      },
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: "2026-04-18",
      branchId: "branch-1",
      totalQtyToRecord: 2,
      totalValueToRecord: 200,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          impliedSold: 3,
          alreadyRecorded: 1,
          qtyToRecord: 2,
          qtyRecorded: null,
          unitPrice: 100,
          lineValue: 200,
          status: null,
        },
      ],
    });
    render(
      <MemoryRouter>
        <Provider store={store}>
          <QueryClientProvider client={qc}>
            <ToastProvider>
              <StandardStockCountSheetPage />
            </ToastProvider>
          </QueryClientProvider>
        </Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /record sales/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /record sales/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /record sales from stock count/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/1 product\(s\) to record/i)).toBeInTheDocument();
    expect(screen.getByText(/2 units/i)).toBeInTheDocument();
    expect(stdApi.fetchStdStockCountSalesPreview).toHaveBeenCalledWith(
      "t",
      "org-1",
      "branch-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("record sales preview uses full sheet not current page", async () => {
    const store = configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
        cart: cartReducer,
      },
      preloadedState: {
        auth: {
          token: "t",
          iamUserId: "u",
          username: null,
          expiresAt: null,
          refreshToken: null,
          roles: [],
        },
        orgContext: {
          orgId: "org-1",
          orgName: "Acme",
          branchId: "branch-1",
          branchName: "Main",
          terminalId: "term-1",
          terminalName: "T1",
        },
      },
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const previewLines = Array.from({ length: 73 }, (_, i) => ({
      itemId: `item-${i + 1}`,
      name: `Product ${i + 1}`,
      impliedSold: i === 49 ? 5 : 0,
      alreadyRecorded: 0,
      qtyToRecord: i === 49 ? 5 : 0,
      qtyRecorded: null,
      unitPrice: 100,
      lineValue: i === 49 ? 500 : 0,
      status: null,
    }));
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: "2026-06-07",
      branchId: "branch-1",
      totalQtyToRecord: 5,
      totalValueToRecord: 500,
      lines: previewLines,
    });

    render(
      <MemoryRouter>
        <Provider store={store}>
          <QueryClientProvider client={qc}>
            <ToastProvider>
              <StandardStockCountSheetPage />
            </ToastProvider>
          </QueryClientProvider>
        </Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Product 50")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /record sales/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /record sales/i }));

    await waitFor(() => {
      expect(screen.getByText(/73 products/i)).toBeInTheDocument();
      expect(screen.getByText("Product 50")).toBeInTheDocument();
    });
    expect(stdApi.fetchStdStockCountSalesPreview).toHaveBeenCalled();
    expect(stdApi.fetchStdStockCountSalesPreview).toHaveBeenLastCalledWith(
      "t",
      "org-1",
      "branch-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("shows filter banner in preview when table search is active", async () => {
    const store = configureStore({
      reducer: {
        auth: authReducer,
        orgContext: orgContextReducer,
        cart: cartReducer,
      },
      preloadedState: {
        auth: {
          token: "t",
          iamUserId: "u",
          username: null,
          expiresAt: null,
          refreshToken: null,
          roles: [],
        },
        orgContext: {
          orgId: "org-1",
          orgName: "Acme",
          branchId: "branch-1",
          branchName: "Main",
          terminalId: "term-1",
          terminalName: "T1",
        },
      },
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: "2026-06-07",
      branchId: "branch-1",
      totalQtyToRecord: 1,
      totalValueToRecord: 100,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          impliedSold: 1,
          alreadyRecorded: 0,
          qtyToRecord: 1,
          qtyRecorded: null,
          unitPrice: 100,
          lineValue: 100,
          status: null,
        },
      ],
    });

    render(
      <MemoryRouter>
        <Provider store={store}>
          <QueryClientProvider client={qc}>
            <ToastProvider>
              <StandardStockCountSheetPage />
            </ToastProvider>
          </QueryClientProvider>
        </Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/search all columns/i), {
      target: { value: "Product 1" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /record sales/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /record sales/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/table filter is active — record sales still uses the full sheet/i)
      ).toBeInTheDocument();
    });
  });
});

describe("StandardStockCountSheetPage save button", () => {
  const savedAt = "2026-06-06T10:00:00.000Z";
  const laterSavedAt = "2026-06-06T14:30:00.000Z";

  beforeEach(() => {
    vi.mocked(stdApi.saveStdStockCount).mockReset();
    vi.mocked(debtsApi.fetchDebts).mockResolvedValue([] as never);
    vi.mocked(analyticsApi.fetchOperatorAnalyticsSnapshot).mockResolvedValue({
      expenseIntelligence: { todayTotal: 0 },
    } as never);
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: "2026-06-06",
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [],
    });
    vi.mocked(stdApi.recordStdStockCountSales).mockResolvedValue({
      date: "2026-06-06",
      terminalId: "term-1",
      totalItemsRecorded: 0,
      totalValue: 0,
      saleIds: [],
      lines: [],
    });
  });

  it("disables Save when all visible rows are saved and unchanged", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: "2026-06-06",
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 10,
          lastSavedAt: savedAt,
          comments: null,
        },
        {
          itemId: "item-2",
          sku: "SKU002",
          name: "Product 2",
          openingStock: 5,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 50,
          closingStock: 5,
          lastSavedAt: savedAt,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("disables Save when row 0 is unsaved but other rows are saved", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: "2026-06-06",
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 0,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: null,
          lastSavedAt: null,
          comments: null,
        },
        {
          itemId: "item-2",
          sku: "SKU002",
          name: "Product 2",
          openingStock: 8,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 80,
          closingStock: 8,
          lastSavedAt: laterSavedAt,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(screen.getByText(/saved:/i)).toBeInTheDocument();
  });

  it("keeps Save disabled after retyping the saved closing value", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: "2026-06-06",
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 6,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 6,
          lastSavedAt: savedAt,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("6")).toBeInTheDocument();
    });

    const closingInput = screen.getByDisplayValue("6");
    fireEvent.change(closingInput, { target: { value: "6" } });
    fireEvent.blur(closingInput);

    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("enables Save after editing a saved closing", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: "2026-06-06",
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 10,
          lastSavedAt: savedAt,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "8" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
  });

  describe("auto-save on added change", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(async () => {
      await vi.runOnlyPendingTimersAsync();
      vi.clearAllTimers();
      vi.useRealTimers();
    });

  it(
    "auto-saves stale closing when added stock exceeds saved closing",
    async () => {
      const today = localTodayStr();
      vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [
          {
            itemId: "item-1",
            sku: "SKU001",
            name: "Bond 7 - 750ml",
            openingStock: 0,
            addedStock: 1,
            addedTodayStock: 0,
            sellingPrice: 100,
            closingStock: 0,
            lastSavedAt: "2026-06-08T10:00:00.000Z",
            comments: null,
          },
        ],
      });
      vi.mocked(stdApi.saveStdStockCount).mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [
          {
            itemId: "item-1",
            sku: "SKU001",
            name: "Bond 7 - 750ml",
            openingStock: 0,
            addedStock: 1,
            addedTodayStock: 0,
            sellingPrice: 100,
            closingStock: 1,
            lastSavedAt: "2026-06-09T12:00:00.000Z",
            comments: null,
          },
        ],
      });

      wrap(<StandardStockCountSheetPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("1")).toBeInTheDocument();
      });

      await vi.advanceTimersByTimeAsync(1500);

      await waitFor(() => {
        expect(stdApi.saveStdStockCount).toHaveBeenCalledWith(
          "t",
          "org-1",
          "branch-1",
          expect.objectContaining({
            date: today,
            counts: [
              expect.objectContaining({
                itemId: "item-1",
                closingStock: 1,
              }),
            ],
          })
        );
      });
    },
    10000
  );

  it(
    "auto-saves Viceroy stale closing when saved closing equals opening and GRN added",
    async () => {
      const today = localTodayStr();
      vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [
          {
            itemId: "item-viceroy",
            sku: "VIC250",
            name: "Viceroy 250ml",
            openingStock: 1,
            addedStock: 2,
            addedTodayStock: 0,
            sellingPrice: 100,
            closingStock: 1,
            lastSavedAt: "2026-06-08T10:00:00.000Z",
            comments: null,
          },
        ],
      });
      vi.mocked(stdApi.saveStdStockCount).mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [
          {
            itemId: "item-viceroy",
            sku: "VIC250",
            name: "Viceroy 250ml",
            openingStock: 1,
            addedStock: 2,
            addedTodayStock: 0,
            sellingPrice: 100,
            closingStock: 3,
            lastSavedAt: "2026-06-09T12:00:00.000Z",
            comments: null,
          },
        ],
      });

      wrap(<StandardStockCountSheetPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("3")).toBeInTheDocument();
      });

      await vi.advanceTimersByTimeAsync(1500);

      await waitFor(() => {
        expect(stdApi.saveStdStockCount).toHaveBeenCalledWith(
          "t",
          "org-1",
          "branch-1",
          expect.objectContaining({
            date: today,
            counts: [
              expect.objectContaining({
                itemId: "item-viceroy",
                closingStock: 3,
              }),
            ],
          })
        );
      });
    },
    10000
  );

  it("does not auto-save sold row when added unchanged", async () => {
    const today = localTodayStr();
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-750",
          sku: "VIC750",
          name: "Viceroy 750ml",
          openingStock: 8,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 5,
          lastSavedAt: "2026-06-08T10:00:00.000Z",
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(stdApi.saveStdStockCount).not.toHaveBeenCalled();
  });

  });

  it(
    "auto-saves when added increases on refetch",
    async () => {
      const today = localTodayStr();
      const initialRow = {
        itemId: "item-1",
        sku: "SKU001",
        name: "Product 1",
        openingStock: 1,
        addedStock: 0,
        addedTodayStock: 0,
        sellingPrice: 100,
        closingStock: 1,
        lastSavedAt: "2026-06-09T10:00:00.000Z",
        comments: null as string | null,
      };
      vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [initialRow],
      });
      vi.mocked(stdApi.saveStdStockCount).mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [
          {
            ...initialRow,
            addedStock: 2,
            closingStock: 3,
            lastSavedAt: "2026-06-09T12:00:00.000Z",
          },
        ],
      });

      const { queryClient } = wrap(<StandardStockCountSheetPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("1")).toBeInTheDocument();
      });

      const sheetQuery = queryClient
        .getQueryCache()
        .getAll()
        .find((q) => q.queryKey[0] === "std-stock-count");
      expect(sheetQuery).toBeDefined();

      await act(async () => {
        queryClient.setQueryData(sheetQuery!.queryKey, {
          date: today,
          outletId: "branch-1",
          rows: [{ ...initialRow, addedStock: 2 }],
        });
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("3")).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(stdApi.saveStdStockCount).toHaveBeenCalledWith(
          "t",
          "org-1",
          "branch-1",
          expect.objectContaining({
            date: today,
            counts: [
              expect.objectContaining({
                itemId: "item-1",
                closingStock: 3,
              }),
            ],
          })
        );
      }, { timeout: 3000 });
    },
    10000
  );
});

describe("StandardStockCountSheetPage new day carry-forward", () => {
  beforeEach(() => {
    vi.mocked(stdApi.saveStdStockCount).mockReset();
    vi.mocked(debtsApi.fetchDebts).mockResolvedValue([] as never);
    vi.mocked(analyticsApi.fetchOperatorAnalyticsSnapshot).mockResolvedValue({
      expenseIntelligence: { todayTotal: 0 },
    } as never);
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: localTodayStr(),
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [],
    });
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: localTodayStr(),
      branchId: "branch-1",
      itemsAdjusted: 0,
      itemsAlreadyMatched: 0,
      lines: [],
    });
  });

  it("auto-saves carried opening as closing on new day and disables Save after", async () => {
    const today = localTodayStr();
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 5,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: null,
          lastSavedAt: null,
          comments: null,
        },
      ],
    });
    vi.mocked(stdApi.saveStdStockCount).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 5,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 5,
          lastSavedAt: "2026-06-10T08:00:00.000Z",
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(stdApi.saveStdStockCount).toHaveBeenCalledTimes(1);
      expect(stdApi.saveStdStockCount).toHaveBeenCalledWith(
        "t",
        "org-1",
        "branch-1",
        expect.objectContaining({
          date: today,
          counts: [
            expect.objectContaining({
              itemId: "item-1",
              closingStock: 5,
            }),
          ],
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });
});

describe("StandardStockCountSheetPage reconcile inventory", () => {
  beforeEach(() => {
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockReset();
    vi.mocked(stdApi.reconcileStdStockCountInventory).mockReset();
    vi.mocked(stdApi.saveStdStockCount).mockReset();
    vi.mocked(debtsApi.fetchDebts).mockResolvedValue([] as never);
    vi.mocked(analyticsApi.fetchOperatorAnalyticsSnapshot).mockResolvedValue({
      expenseIntelligence: { todayTotal: 0 },
    } as never);
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: localTodayStr(),
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [],
    });
  });

  it("hides reconcile button when preview has no mismatches", async () => {
    const today = localTodayStr();
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 5,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 5,
          lastSavedAt: "2026-06-09T12:00:00.000Z",
          comments: null,
        },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      itemsAdjusted: 0,
      itemsAlreadyMatched: 1,
      lines: [],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(stdApi.fetchStdStockCountReconcilePreview).toHaveBeenCalled();
    });

    expect(screen.queryByRole("button", { name: /reconcile inventory/i })).not.toBeInTheDocument();
  });

  it("preview mismatch opens modal, confirm reconcile, and show success", async () => {
    const today = localTodayStr();
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 5,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 5,
          lastSavedAt: "2026-06-09T12:00:00.000Z",
          comments: null,
        },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      itemsAdjusted: 1,
      itemsAlreadyMatched: 0,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          closingStock: 5,
          onHandQty: 3,
          variance: 2,
        },
      ],
    });
    vi.mocked(stdApi.reconcileStdStockCountInventory).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      adjustedCount: 1,
      itemsAlreadyMatched: 0,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          closingStock: 5,
          onHandQty: 3,
          variance: 2,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reconcile inventory/i })).toBeEnabled();
    });

    await waitFor(() => {
      expect(stdApi.fetchStdStockCountReconcilePreview).toHaveBeenCalledWith(
        "t",
        "org-1",
        "branch-1",
        today
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /reconcile inventory/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/pos on-hand will be set to today/i)
      ).toBeInTheDocument();
    });

    const reconcileButtons = screen.getAllByRole("button", { name: /reconcile inventory/i });
    fireEvent.click(reconcileButtons[reconcileButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.getByText(/reconcile inventory to closings\?/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^reconcile$/i }));

    await waitFor(() => {
      expect(stdApi.reconcileStdStockCountInventory).toHaveBeenCalledWith(
        "t",
        "org-1",
        "branch-1",
        { date: today, outletId: "branch-1" }
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/adjusted on-hand for 1 item/i)).toBeInTheDocument();
    });
  });
});
