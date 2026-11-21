package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.dto.StdStockCountAutoSyncResponse;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcilePreviewDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountReconcileResponse;
import com.blinc.xpos.modules.inventory.dto.StdStockCountRecordSalesResponse;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSalesPreviewDto;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSheetDto;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Standard Stock Count Sheet: bar-style sheet where Opening + Added = Total Stock, Units Sold =
 * Total - Closing, Amount = Units Sold × Selling Price.
 */
public interface StdStockCountService {

  StdStockCountSheetDto getSheet(UUID orgId, UUID branchId, LocalDate businessDate);

  StdStockCountSheetDto saveCounts(
      UUID orgId, UUID branchId, UUID staffUserId, StdStockCountSaveRequest request);

  /** Preview implied sales from saved closings, reconciled against completed sales on the date. */
  StdStockCountSalesPreviewDto previewSalesFromSheet(
      UUID orgId, UUID branchId, LocalDate businessDate);

  /**
   * Record delta sales (implied minus already completed) via the sales-recording pipeline. Future:
   * gate with {@code STD_STOCK_COUNT_RECORD_SALES} permission when role matrix expands.
   */
  StdStockCountRecordSalesResponse recordSalesFromSheet(
      UUID orgId, UUID branchId, UUID terminalId, UUID staffUserId, LocalDate businessDate);

  /** Compare saved closings to branch on-hand for inventory-tracked sellable items. */
  StdStockCountReconcilePreviewDto previewReconcileInventory(
      UUID orgId, UUID branchId, LocalDate businessDate);

  /** Set on-hand qty to saved closing (today only); creates ADJUST stock movements for variance. */
  StdStockCountReconcileResponse reconcileInventoryToClosing(
      UUID orgId, UUID branchId, UUID staffUserId, LocalDate businessDate);

  /**
   * Persist carry-forward closings for missing/stale snapshot rows from the last saved date through
   * today (branch timezone). Idempotent; safe to run on a schedule.
   */
  StdStockCountAutoSyncResponse autoSyncCarryForward(UUID orgId, UUID branchId);

  /**
   * Recalibrate and persist closing snapshots for a business date through today (branch timezone),
   * clamping any snapshots whose saved closing exceeds physical available stock (e.g. after stock
   * receipt deletion or reduction).
   */
  int syncSnapshotsForDate(UUID orgId, UUID branchId, LocalDate businessDate);
}
