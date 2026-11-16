import NetInfo from "@react-native-community/netinfo";
import { type QueryClient } from "@tanstack/react-query";
import { catalogRepository } from "@/repositories/catalogRepository";
import { stockCountRepository } from "@/repositories/stockCountRepository";
import { receivingRepository } from "@/repositories/receivingRepository";
import { debtsExpensesRepository } from "@/repositories/debtsExpensesRepository";
import { revenueRepository } from "@/repositories/revenueRepository";
import { fetchStdStockCountSheet, fetchStdStockCountSalesPreview } from "@/api/stdStockCount";
import { fetchGoodsReceiptNotes } from "@/api/goodsReceiptNotes";
import { fetchSuppliers } from "@/api/suppliers";
import { fetchDebts } from "@/api/debts";
import { fetchMiscExpenses } from "@/api/miscExpenses";
import { outboxEngine } from "./outboxEngine";

class SyncScheduler {
  private isHydrating = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private queryClient: QueryClient | null = null;
  private currentContext: { token: string; orgId: string; branchId: string } | null = null;

  public init(queryClient: QueryClient) {
    this.queryClient = queryClient;
    outboxEngine.setBecameOnlineHandler(() => {
      void this.triggerHydration();
    });
  }

  public setContext(context: { token: string; orgId: string; branchId: string } | null) {
    this.currentContext = context;
    if (context) {
      void this.triggerHydration();
      this.startInterval();
    } else {
      this.stopInterval();
    }
  }

  public startInterval() {
    if (this.intervalId) return;
    // Run background hydration every 60 seconds
    this.intervalId = setInterval(() => {
      void this.triggerHydration();
    }, 60_000);
  }

  public stopInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Runs non-blocking background hydration of all core domains in sequence.
   * Ensures UI never stalls while keeping local SQLite fresh.
   */
  public async triggerHydration(): Promise<void> {
    if (this.isHydrating || !this.currentContext) return;
    const { token, orgId, branchId } = this.currentContext;
    if (!token || !orgId || !branchId) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    this.isHydrating = true;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Catalog & Categories
      try {
        await catalogRepository.hydrateCatalog(token, orgId);
        this.queryClient?.invalidateQueries({ queryKey: ["local-catalog-categories", orgId] });
        this.queryClient?.invalidateQueries({ queryKey: ["local-catalog-items", orgId] });
      } catch {}

      // 2. Suppliers
      try {
        const suppliersRes = await fetchSuppliers(token, orgId);
        if (suppliersRes?.content) {
          await receivingRepository.hydrateSuppliersFromRemote(orgId, suppliersRes.content);
          this.queryClient?.invalidateQueries({ queryKey: ["local-suppliers", orgId] });
        }
      } catch {}

      // 3. Stock Count Sheet & Sales Preview (Today)
      try {
        const [sheet, preview] = await Promise.all([
          fetchStdStockCountSheet(token, orgId, branchId, todayStr).catch(() => null),
          fetchStdStockCountSalesPreview(token, orgId, branchId, todayStr).catch(() => null),
        ]);
        if (sheet?.rows) {
          await stockCountRepository.hydrateFromRemote(orgId, branchId, sheet);
          this.queryClient?.invalidateQueries({
            queryKey: ["local-stock-count-sheet", orgId, branchId, todayStr],
          });
        }
        if (preview?.lines) {
          await stockCountRepository.hydrateSalesPreviewFromRemote(orgId, branchId, preview);
          this.queryClient?.invalidateQueries({
            queryKey: ["std-stock-count-sales-preview", orgId, branchId, todayStr],
          });
        }
      } catch {}

      // 4. Goods Receipt Notes
      try {
        const grns = await fetchGoodsReceiptNotes(token, orgId, branchId, {
          page: 0,
          size: 200,
          includeInactive: false,
        });
        if (grns?.content) {
          await receivingRepository.hydrateFromRemote(orgId, branchId, grns.content);
          this.queryClient?.invalidateQueries({
            queryKey: ["local-goods-receipt-notes", orgId, branchId],
          });
        }
      } catch {}

      // 5. Customer Debts & Expenses
      try {
        const [debts, expenses] = await Promise.all([
          fetchDebts(token, orgId, branchId, { page: 0, size: 200, sort: "createdAt,desc" }),
          fetchMiscExpenses(token, orgId, branchId, { page: 0, size: 200, sort: "createdAt,desc" }),
        ]);
        if (debts?.content) {
          await debtsExpensesRepository.hydrateDebtsFromRemote(orgId, branchId, debts.content);
          this.queryClient?.invalidateQueries({ queryKey: ["local-debts-list", orgId, branchId] });
        }
        if (expenses?.content) {
          await debtsExpensesRepository.hydrateExpensesFromRemote(orgId, branchId, expenses.content);
          this.queryClient?.invalidateQueries({ queryKey: ["local-expenses-list", orgId, branchId] });
        }
      } catch {}

      // 6. Revenue Dashboard
      try {
        await revenueRepository.hydrateDashboard(token, orgId, branchId, todayStr, todayStr);
      } catch {}

      // Also ensure any pending outbox mutations are processed
      void outboxEngine.processQueue();
    } finally {
      this.isHydrating = false;
    }
  }
}

export const syncScheduler = new SyncScheduler();
