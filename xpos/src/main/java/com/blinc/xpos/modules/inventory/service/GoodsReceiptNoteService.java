package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.GoodsReceiptNote;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface GoodsReceiptNoteService {

  default GoodsReceiptNote create(
      UUID orgId,
      UUID branchId,
      UUID supplierId,
      UUID purchaseOrderId,
      UUID receivedByStaffUserId,
      List<GrnLineRequest> lines) {
    return create(orgId, branchId, supplierId, purchaseOrderId, receivedByStaffUserId, null, lines);
  }

  GoodsReceiptNote create(
      UUID orgId,
      UUID branchId,
      UUID supplierId,
      UUID purchaseOrderId,
      UUID receivedByStaffUserId,
      java.time.Instant receivedAt,
      List<GrnLineRequest> lines);

  GoodsReceiptNote require(UUID orgId, UUID grnId);

  Page<GoodsReceiptNote> listByBranch(
      UUID orgId, UUID branchId, boolean includeInactive, Pageable pageable);

  GoodsReceiptNote update(
      UUID orgId,
      UUID grnId,
      UUID supplierId,
      java.time.Instant receivedAt,
      Boolean active,
      List<GrnLineRequest> lines,
      UUID updatedByStaffUserId);

  /**
   * Permanently deletes the receipt, its lines, and all stock movements sourced to this GRN.
   * Reverses the net inventory effect of those movements (fails if on-hand would go negative).
   */
  void deletePermanently(UUID orgId, UUID grnId);

  record GrnLineRequest(UUID itemId, BigDecimal qty, UUID uomId, BigDecimal receivedUnitCost) {}
}
