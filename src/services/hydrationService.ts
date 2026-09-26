import { getDatabase, withTransaction } from "@/db/sqlite";
import { catalogRepository } from "@/repositories/catalogRepository";
import { stockCountRepository } from "@/repositories/stockCountRepository";
import { receivingRepository } from "@/repositories/receivingRepository";
import { fetchSuppliers } from "@/api/suppliers";
import { fetchStdStockCountSheet } from "@/api/stdStockCount";
import { fetchGoodsReceiptNotes } from "@/api/goodsReceiptNotes";

export interface HydrationProgress {
  isHydrating: boolean;
  step: string;
  percent: number;
  completedAt: string | null;
  error: string | null;
}

type HydrationListener = (progress: HydrationProgress) => void;

class HydrationService {
  private isHydrating = false;
  private listeners: Set<HydrationListener> = new Set();
  private progress: HydrationProgress = {
    isHydrating: false,
    step: "idle",
    percent: 100,
    completedAt: null,
    error: null,
  };

  public subscribe(listener: HydrationListener): () => void {
    this.listeners.add(listener);
    listener(this.progress);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private update(partial: Partial<HydrationProgress>) {
    this.progress = { ...this.progress, ...partial };
    this.listeners.forEach((fn) => fn(this.progress));
  }

  /**
   * Performs full remote-to-local cold-start synchronization on login or branch change:
   * 1. Catalog Items & Categories
   * 2. Suppliers
   * 3. Current Stock Count Sheet
   * 4. Goods Receipt Notes
   */
  public async hydrateAll(
    token: string,
    orgId: string,
    branchId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isHydrating) return { success: true };
    this.isHydrating = true;
    this.update({ isHydrating: true, step: "Starting sync…", percent: 5, error: null });

    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;

      // 1. Catalog (Categories & Items)
      this.update({ step: "Synchronizing catalog…", percent: 20 });
      await catalogRepository.hydrateCatalog(token, orgId);

      // 2. Suppliers
      this.update({ step: "Synchronizing suppliers…", percent: 45 });
      try {
        const suppliersRes = await fetchSuppliers(token, orgId, { size: 200 });
        if (suppliersRes?.content) {
          await withTransaction(async (db) => {
            for (const s of suppliersRes.content) {
              const dt = new Date().toISOString();
              await db.runAsync(
                `INSERT INTO suppliers (id, org_id, name, contact_person, phone, email, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   phone = excluded.phone,
                   email = excluded.email,
                   updated_at = excluded.updated_at`,
                [s.id, orgId, s.name, null, s.phone, s.email, s.createdAt || dt, s.updatedAt || dt]
              );
            }
          });
        }
      } catch (e) {
        console.warn("[HydrationService] Supplier sync warning:", e);
      }

      // 3. Stock Count Sheet
      this.update({ step: "Synchronizing stock count…", percent: 70 });
      try {
        const sheetRes = await fetchStdStockCountSheet(token, orgId, branchId, todayStr);
        if (sheetRes) {
          await stockCountRepository.hydrateFromRemote(orgId, branchId, sheetRes);
        }
      } catch (e) {
        console.warn("[HydrationService] Stock count sync warning:", e);
      }

      // 4. Goods Receipt Notes
      this.update({ step: "Synchronizing stock receipts…", percent: 90 });
      try {
        const grnRes = await fetchGoodsReceiptNotes(token, orgId, branchId, {
          page: 0,
          size: 100,
          includeInactive: false,
        });
        if (grnRes?.content) {
          await receivingRepository.hydrateFromRemote(orgId, branchId, grnRes.content);
        }
      } catch (e) {
        console.warn("[HydrationService] GRN sync warning:", e);
      }

      // 5. Store completed flag in store_settings
      const completedIso = new Date().toISOString();
      await withTransaction(async (db) => {
        await db.runAsync(
          `INSERT OR REPLACE INTO store_settings (key, value, updated_at)
           VALUES ('last_cold_hydration_at', ?, ?)`,
          [completedIso, completedIso]
        );
      });

      this.update({
        isHydrating: false,
        step: "Sync complete",
        percent: 100,
        completedAt: completedIso,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const errMsg = err?.message || "Sync failed";
      this.update({
        isHydrating: false,
        step: "Sync failed",
        percent: 100,
        error: errMsg,
      });
      return { success: false, error: errMsg };
    } finally {
      this.isHydrating = false;
    }
  }

  public getProgress(): HydrationProgress {
    return this.progress;
  }
}

export const hydrationService = new HydrationService();
