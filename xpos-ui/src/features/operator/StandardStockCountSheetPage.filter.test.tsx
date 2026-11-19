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
import type { StdStockCountRowResponse } from "@/api/stdStockCount";
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

function wrap(component: React.ReactElement, terminalId: string | null = null) {
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
        terminalId,
        terminalName: terminalId ? "Terminal 1" : null,
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
    vi.mocked(stdApi.autoSyncStdStockCount).mockResolvedValue({
      date: localTodayStr(),
      rowsSynced: 0,
    });
    const rows = Array.from({ length: 73 }, (_, i) => ({
      itemId: `item-${i + 1}`,
      sku: `SKU${String(i + 1).padStart(3, "0")}`,
      name: `Product ${i + 1}`,
      openingStock: 0,
      addedStock: 0,
      addedTodayStock: 0,
      sellingPrice: 100,
      closingStock: 10,
      lastSavedAt: "2026-06-15T08:00:00Z",
      firstStockAddedAt: null,
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

  it("when searching hides rows whose displayed closing and sold are both zero", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: localTodayStr(),
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-a",
          sku: "SKU-A",
          name: "Balozi Zero",
          openingStock: 0,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 0,
          lastSavedAt: "2026-06-15T08:00:00Z",
          firstStockAddedAt: null,
          comments: null,
        },
        {
          itemId: "item-b",
          sku: "SKU-B",
          name: "Balozi Active",
          openingStock: 0,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 5,
          lastSavedAt: "2026-06-15T08:00:00Z",
          firstStockAddedAt: null,
          comments: null,
        },
        {
          itemId: "item-c",
          sku: "SKU-C",
          name: "Balozi Sold Out",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 0,
          lastSavedAt: "2026-06-15T08:00:00Z",
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);
    await waitFor(() => {
      expect(screen.getByText("Balozi Zero")).toBeInTheDocument();
      expect(screen.getByText("Balozi Active")).toBeInTheDocument();
      expect(screen.getByText("Balozi Sold Out")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/search all columns/i);
    fireEvent.change(input, { target: { value: "Balozi" } });

    await waitFor(() => {
      expect(screen.getByText("Balozi Active")).toBeInTheDocument();
      expect(screen.getByText("Balozi Sold Out")).toBeInTheDocument();
      expect(screen.queryByText("Balozi Zero")).not.toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByText("Balozi Zero")).toBeInTheDocument();
      expect(screen.getByText("Balozi Active")).toBeInTheDocument();
      expect(screen.getByText("Balozi Sold Out")).toBeInTheDocument();
    });
  });

  it("disables Record sales when terminal context is missing", async () => {
    wrap(<StandardStockCountSheetPage />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /record sales/i })).not.toBeInTheDocument();
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
      expect(screen.queryByRole("button", { name: /record sales/i })).not.toBeInTheDocument();
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
          firstStockAddedAt: null,
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
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
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
          firstStockAddedAt: null,
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
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
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
          firstStockAddedAt: null,
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

    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
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
          firstStockAddedAt: null,
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
            firstStockAddedAt: "2026-06-09T14:00:00.000Z",
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
            firstStockAddedAt: null,
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
            firstStockAddedAt: "2026-06-09T14:00:00.000Z",
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
            firstStockAddedAt: null,
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

  it(
    "does not auto-save closing at opening when save is after first stock receipt",
    async () => {
      const today = localTodayStr();
      vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [
          {
            itemId: "item-kane",
            sku: "KANE250",
            name: "Kane xtra 250ml",
            openingStock: 6.25,
            addedStock: 3,
            addedTodayStock: 0,
            sellingPrice: 280,
            closingStock: 6.25,
            lastSavedAt: "2026-06-15T19:00:00.000Z",
            firstStockAddedAt: "2026-06-15T14:00:00.000Z",
            comments: null,
          },
        ],
      });

      wrap(<StandardStockCountSheetPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("6.25")).toBeInTheDocument();
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(stdApi.saveStdStockCount).not.toHaveBeenCalled();
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
          firstStockAddedAt: null,
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
        firstStockAddedAt: null,
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
          rows: [
            {
              ...initialRow,
              addedStock: 2,
              firstStockAddedAt: "2026-06-09T11:00:00.000Z",
            },
          ],
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
    vi.mocked(stdApi.autoSyncStdStockCount).mockReset();
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
    const savedRow = {
      itemId: "item-1",
      sku: "SKU001",
      name: "Product 1",
      openingStock: 5,
      addedStock: 0,
      addedTodayStock: 0,
      sellingPrice: 100,
      closingStock: 5,
      lastSavedAt: "2026-06-10T08:00:00.000Z",
      firstStockAddedAt: null,
      comments: null,
    };
    vi.mocked(stdApi.fetchStdStockCountSheet)
      .mockResolvedValueOnce({
        date: today,
        outletId: "branch-1",
        rows: [
          {
            ...savedRow,
            closingStock: null,
            lastSavedAt: null,
          },
        ],
      })
      .mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [savedRow],
      });
    vi.mocked(stdApi.autoSyncStdStockCount).mockResolvedValue({
      date: today,
      rowsSynced: 1,
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(stdApi.autoSyncStdStockCount).toHaveBeenCalledTimes(1);
      expect(stdApi.autoSyncStdStockCount).toHaveBeenCalledWith(
        "t",
        "org-1",
        "branch-1"
      );
      expect(stdApi.saveStdStockCount).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    });
  });

  it("auto-saves unsaved row with opening 0 but addedStock > 0 on new day", async () => {
    const today = localTodayStr();
    const unsavedRow: StdStockCountRowResponse = {
      itemId: "item-new",
      sku: "SKU-NEW",
      name: "New Product",
      openingStock: 0,
      addedStock: 4,
      addedTodayStock: 0,
      sellingPrice: 150,
      closingStock: null,
      lastSavedAt: null,
      firstStockAddedAt: "2026-06-10T09:00:00Z",
      latestStockAddedAt: "2026-06-10T09:00:00Z",
      comments: null,
    };
    vi.mocked(stdApi.fetchStdStockCountSheet)
      .mockResolvedValueOnce({
        date: today,
        outletId: "branch-1",
        rows: [unsavedRow],
      })
      .mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [{ ...unsavedRow, closingStock: 4, lastSavedAt: "2026-06-10T09:05:00Z" }],
      });
    vi.mocked(stdApi.autoSyncStdStockCount).mockResolvedValue({
      date: today,
      rowsSynced: 1,
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(stdApi.autoSyncStdStockCount).toHaveBeenCalledTimes(1);
    });
  });

  it("auto-saves stale saved closing when afternoon delivery arrives via latestStockAddedAt", async () => {
    const today = localTodayStr();
    const staleRow: StdStockCountRowResponse = {
      itemId: "item-kc",
      sku: "KC01",
      name: "King Cane",
      openingStock: 6,
      addedStock: 4,
      addedTodayStock: 0,
      sellingPrice: 120,
      closingStock: 6,
      lastSavedAt: "2026-06-10T09:00:00Z",
      firstStockAddedAt: "2026-06-10T08:00:00Z",
      latestStockAddedAt: "2026-06-10T14:00:00Z",
      comments: null,
    };
    vi.mocked(stdApi.fetchStdStockCountSheet)
      .mockResolvedValueOnce({
        date: today,
        outletId: "branch-1",
        rows: [staleRow],
      })
      .mockResolvedValue({
        date: today,
        outletId: "branch-1",
        rows: [{ ...staleRow, closingStock: 10, lastSavedAt: "2026-06-10T14:05:00Z" }],
      });
    vi.mocked(stdApi.saveStdStockCount).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [{ ...staleRow, closingStock: 10, lastSavedAt: "2026-06-10T14:05:00Z" }],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(stdApi.saveStdStockCount).toHaveBeenCalledWith(
        "t",
        "org-1",
        "branch-1",
        expect.objectContaining({
          counts: [
            expect.objectContaining({
              itemId: "item-kc",
              closingStock: 10,
            }),
          ],
        })
      );
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
          firstStockAddedAt: null,
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
          firstStockAddedAt: null,
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

describe("StandardStockCountSheetPage rapid input & keyboard flow", () => {
  const today = localTodayStr();

  beforeEach(() => {
    vi.mocked(stdApi.saveStdStockCount).mockReset();
    vi.mocked(debtsApi.fetchDebts).mockResolvedValue([] as never);
    vi.mocked(analyticsApi.fetchOperatorAnalyticsSnapshot).mockResolvedValue({
      expenseIntelligence: { todayTotal: 0 },
    } as never);
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [],
    });
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      itemsAdjusted: 0,
      itemsAlreadyMatched: 0,
      lines: [],
    });
  });

  it("does not wipe out second edited cell when first save completes", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
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
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    let resolveFirstSave: (value: stdApi.StdStockCountSheetResponse) => void;
    const savePromise = new Promise<stdApi.StdStockCountSheetResponse>((resolve) => {
      resolveFirstSave = resolve;
    });
    vi.mocked(stdApi.saveStdStockCount).mockReturnValueOnce(savePromise);

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    const getClosingInputs = () =>
      screen.getAllByRole("textbox").filter((el) => el.getAttribute("inputmode") === "decimal");

    const inputs = getClosingInputs();
    fireEvent.change(inputs[0]!, { target: { value: "8" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    // Wait for first cell to enter Saving... state
    await waitFor(() => {
      expect(inputs[0]!.closest("div")?.textContent).toContain("Saving…");
    });

    // While first save is in-flight, change second input to 3
    fireEvent.change(inputs[1]!, { target: { value: "3" } });
    expect(inputs[1]).toHaveValue("3");

    // First cell shows Saving..., but second cell shows Not saved (NOT Saving...)
    expect(inputs[0]!.closest("div")?.textContent).toContain("Saving…");
    expect(inputs[1]!.closest("div")?.textContent).toContain("Not saved");
    expect(inputs[1]!.closest("div")?.textContent).not.toContain("Saving…");

    // Resolve first save
    act(() => {
      resolveFirstSave!({
        date: today,
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
            closingStock: 8,
            lastSavedAt: new Date().toISOString(),
            firstStockAddedAt: null,
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
            lastSavedAt: "2026-06-06T10:00:00.000Z",
            firstStockAddedAt: null,
            comments: null,
          },
        ],
      });
    });

    // Verify second input was NOT erased or reverted
    await waitFor(() => {
      expect(inputs[1]).toHaveValue("3");
    });
  });

  it("navigates down on Enter or ArrowDown key and up on ArrowUp", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
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
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    const inputs = screen
      .getAllByRole("textbox")
      .filter((el) => el.getAttribute("inputmode") === "decimal");
    inputs[0]!.focus();
    expect(document.activeElement).toBe(inputs[0]);

    fireEvent.keyDown(inputs[0]!, { key: "Enter" });
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.keyDown(inputs[1]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(inputs[0]);
  });

  it("restores offline draft from localStorage and clears it once saved", async () => {
    localStorage.setItem(
      `xpos_stock_count_draft_org-1_branch-1_${today}`,
      JSON.stringify({
        closings: { "item-1": "7" },
        comments: {},
        updatedAt: Date.now(),
      })
    );

    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
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
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 7,
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    // Verify value was restored from draft
    const inputs = screen
      .getAllByRole("textbox")
      .filter((el) => el.getAttribute("inputmode") === "decimal");
    expect(inputs[0]).toHaveValue("7");

    // Click Save
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    // Verify localStorage draft is cleared after save succeeds
    await waitFor(() => {
      expect(
        localStorage.getItem(`xpos_stock_count_draft_org-1_branch-1_${today}`)
      ).toBeNull();
    });
  });

  it("prevents beforeunload when unsaved changes exist", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    const inputs = screen
      .getAllByRole("textbox")
      .filter((el) => el.getAttribute("inputmode") === "decimal");
    fireEvent.change(inputs[0]!, { target: { value: "4" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("clicking closing cell places the cursor immediately on the right side of the digit", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          closingStock: 15,
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    const input = screen
      .getAllByRole("textbox")
      .find((el) => el.getAttribute("inputmode") === "decimal") as HTMLInputElement;

    expect(input.value).toBe("15");

    // Click on the closing cell
    fireEvent.click(input);

    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
  });

  it("hides open, added, and price columns on mobile viewports while keeping amt, total, and sold visible", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU001",
          name: "Product 1",
          openingStock: 10,
          addedStock: 5,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 15,
          lastSavedAt: "2026-06-06T10:00:00.000Z",
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    // Check header columns
    const openTh = screen.getByRole("columnheader", { name: /open/i });
    expect(openTh.className).toContain("hidden xl:table-cell");

    const addedTh = screen.getByRole("columnheader", { name: /added/i });
    expect(addedTh.className).toContain("hidden xl:table-cell");

    const priceTh = screen.getByRole("columnheader", { name: /price/i });
    expect(priceTh.className).toContain("hidden xl:table-cell");

    // Amt, Total and Sold remain visible across mobile
    const amtTh = screen.getByRole("columnheader", { name: /amt/i });
    expect(amtTh.className).not.toContain("hidden");

    const totalTh = screen.getByRole("columnheader", { name: /total/i });
    expect(totalTh.className).not.toContain("hidden");

    const soldTh = screen.getByRole("columnheader", { name: /sold/i });
    expect(soldTh.className).not.toContain("hidden");
  });

  it("shows 'Saving…' status indicator while save is in flight", async () => {
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    let resolveSave: (value: stdApi.StdStockCountSheetResponse) => void;
    const savePromise = new Promise<stdApi.StdStockCountSheetResponse>((resolve) => {
      resolveSave = resolve;
    });
    vi.mocked(stdApi.saveStdStockCount).mockReturnValueOnce(savePromise);

    wrap(<StandardStockCountSheetPage />);

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    const input = screen
      .getAllByRole("textbox")
      .find((el) => el.getAttribute("inputmode") === "decimal") as HTMLInputElement;

    // Change value to make it unsaved
    fireEvent.change(input, { target: { value: "8" } });

    // Initially shows "Not saved"
    expect(screen.getByText("Not saved")).toBeInTheDocument();

    // Trigger save (click save button)
    const saveBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveBtn);

    // While save is in-flight, it should show "Saving…"
    await waitFor(() => {
      expect(screen.getAllByText("Saving…").length).toBeGreaterThanOrEqual(1);
    });

    // Resolve save
    act(() => {
      resolveSave!({
        date: today,
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
            closingStock: 8,
            lastSavedAt: new Date().toISOString(),
            firstStockAddedAt: null,
            comments: null,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.queryAllByText("Saving…")).toHaveLength(0);
    });
  });

  it("shows both Record sales and Reconcile when unrecorded sales and discrepancies exist, hiding text on small screens", async () => {
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      itemsAdjusted: 1,
      itemsAlreadyMatched: 0,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          closingStock: 10,
          onHandQty: 8,
          variance: 2,
        },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      totalQtyToRecord: 2,
      totalValueToRecord: 200,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          impliedSold: 2,
          alreadyRecorded: 0,
          qtyToRecord: 2,
          qtyRecorded: null,
          unitPrice: 100,
          lineValue: 200,
          status: null,
        },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />, "term-1");

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    // Both Record sales and Reconcile are visible
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /record sales/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /reconcile inventory/i })).toBeInTheDocument();

    const recordSalesBtn = screen.getByRole("button", { name: /record sales/i });
    const recordSalesText = recordSalesBtn.querySelector("span");
    expect(recordSalesText?.className).toContain("hidden xl:inline");

    const reconcileBtn = screen.getByRole("button", { name: /reconcile inventory/i });
    const reconcileText = reconcileBtn.querySelector("span");
    expect(reconcileText?.className).toContain("hidden xl:inline");
  });

  it("shows Reconcile only after sales have been recorded and discrepancies exist", async () => {
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          impliedSold: 2,
          alreadyRecorded: 2,
          qtyToRecord: 0,
          qtyRecorded: 2,
          unitPrice: 100,
          lineValue: 0,
          status: null,
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
          closingStock: 10,
          onHandQty: 8,
          variance: 2,
        },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
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
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />, "term-1");

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    // Reconcile is visible, Record sales is strictly hidden
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reconcile inventory/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /record sales/i })).not.toBeInTheDocument();

    const reconcileText = screen.getByText("Reconcile inventory");
    expect(reconcileText.className).toContain("hidden xl:inline");
  });

  it("triggers auto-save quickly (few milliseconds) on cell blur instead of waiting 2.5s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
        date: today,
        branchId: "branch-1",
        totalQtyToRecord: 0,
        totalValueToRecord: 0,
        lines: [],
      });
      vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
        date: today,
        branchId: "branch-1",
        itemsAdjusted: 0,
        itemsAlreadyMatched: 1,
        lines: [],
      });
      vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
        date: today,
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
            lastSavedAt: new Date().toISOString(),
            firstStockAddedAt: null,
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
            openingStock: 10,
            addedStock: 0,
            addedTodayStock: 0,
            sellingPrice: 100,
            closingStock: 8,
            lastSavedAt: new Date().toISOString(),
            firstStockAddedAt: null,
            comments: null,
          },
        ],
      });

      wrap(<StandardStockCountSheetPage />, "term-1");

      await waitFor(() => {
        expect(screen.getByDisplayValue("10")).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "8" } });

      // Cell displays "Not saved"
      expect(screen.getByText("Not saved")).toBeInTheDocument();

      // After 100ms without blur, save has NOT been called (2.5s typing debounce is active)
      await vi.advanceTimersByTimeAsync(100);
      expect(stdApi.saveStdStockCount).not.toHaveBeenCalled();

      // User leaves the cell (blur)
      fireEvent.blur(input);

      // Within ~200ms of leaving the cell, save is executed
      await vi.advanceTimersByTimeAsync(200);

      expect(stdApi.saveStdStockCount).toHaveBeenCalledWith(
        "t",
        "org-1",
        "branch-1",
        expect.objectContaining({
          counts: [
            expect.objectContaining({
              itemId: "item-1",
              closingStock: 8,
            }),
          ],
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("displays unique item count on Record sales badge instead of total quantity sum (e.g. 2 items for 2 tuskers and 4 best gin)", async () => {
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      totalQtyToRecord: 6,
      totalValueToRecord: 1200,
      lines: [
        {
          itemId: "item-tusker",
          name: "Tusker",
          impliedSold: 2,
          alreadyRecorded: 0,
          qtyToRecord: 2,
          qtyRecorded: null,
          unitPrice: 200,
          lineValue: 400,
          status: null,
        },
        {
          itemId: "item-gin",
          name: "Best Gin",
          impliedSold: 4,
          alreadyRecorded: 0,
          qtyToRecord: 4,
          qtyRecorded: null,
          unitPrice: 200,
          lineValue: 800,
          status: null,
        },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      itemsAdjusted: 0,
      itemsAlreadyMatched: 2,
      lines: [],
    });
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-tusker",
          sku: "SKU-TUSKER",
          name: "Tusker",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 200,
          closingStock: 8,
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
        {
          itemId: "item-gin",
          sku: "SKU-GIN",
          name: "Best Gin",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 200,
          closingStock: 6,
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />, "term-1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /record sales/i })).toBeInTheDocument();
    });

    const recordSalesBtn = screen.getByRole("button", { name: /record sales/i });
    const badge = recordSalesBtn.querySelector("span.rounded-full");
    expect(badge).toHaveTextContent("2");
    expect(recordSalesBtn).toHaveAttribute("aria-label", "Record sales (2 items)");
  });

  it("displays unique item count badge on Reconcile inventory button", async () => {
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [],
    });
    vi.mocked(stdApi.fetchStdStockCountReconcilePreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      itemsAdjusted: 3,
      itemsAlreadyMatched: 1,
      lines: [
        { itemId: "item-1", name: "Product 1", closingStock: 10, onHandQty: 8, variance: 2 },
        { itemId: "item-2", name: "Product 2", closingStock: 5, onHandQty: 7, variance: -2 },
        { itemId: "item-3", name: "Product 3", closingStock: 12, onHandQty: 10, variance: 2 },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU-1",
          name: "Product 1",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 100,
          closingStock: 10,
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />, "term-1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reconcile inventory/i })).toBeInTheDocument();
    });

    const reconcileBtn = screen.getByRole("button", { name: /reconcile inventory/i });
    const badge = reconcileBtn.querySelector("span.rounded-full");
    expect(badge).toHaveTextContent("3");
    expect(reconcileBtn).toHaveAttribute("aria-label", "Reconcile inventory (3 items)");
  });

  it("displays Tot: amount badge in top bar before date filter", async () => {
    const today = localTodayStr();
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [],
    });
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU-1",
          name: "Product 1",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 150,
          closingStock: 6,
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />, "term-1");

    // 4 units sold * 150 = 600
    await waitFor(() => {
      const badges = screen.getAllByTitle(/Total sales amount/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);
      expect(badges[0]).toHaveTextContent(/Tot:/i);
      expect(badges[0]).toHaveTextContent(/600/i);
    });
  });

  it("does not show Record sales button with ghost count when server preview has 0 remaining and no unsaved changes", async () => {
    const today = localTodayStr();
    vi.mocked(stdApi.fetchStdStockCountSalesPreview).mockResolvedValue({
      date: today,
      branchId: "branch-1",
      totalQtyToRecord: 0,
      totalValueToRecord: 0,
      lines: [
        {
          itemId: "item-1",
          name: "Product 1",
          impliedSold: 4,
          alreadyRecorded: 4,
          qtyToRecord: 0,
          qtyRecorded: 4,
          unitPrice: 150,
          lineValue: 0,
          status: "RECORDED",
        },
      ],
    });
    vi.mocked(stdApi.fetchStdStockCountSheet).mockResolvedValue({
      date: today,
      outletId: "branch-1",
      rows: [
        {
          itemId: "item-1",
          sku: "SKU-1",
          name: "Product 1",
          openingStock: 10,
          addedStock: 0,
          addedTodayStock: 0,
          sellingPrice: 150,
          closingStock: 6,
          lastSavedAt: new Date().toISOString(),
          firstStockAddedAt: null,
          comments: null,
        },
      ],
    });

    wrap(<StandardStockCountSheetPage />, "term-1");

    await waitFor(() => {
      expect(screen.getByText("Product 1")).toBeInTheDocument();
    });

    // Record sales button should NOT be in the document because remaining to record is 0
    expect(screen.queryByRole("button", { name: /record sales/i })).not.toBeInTheDocument();
  });
});

