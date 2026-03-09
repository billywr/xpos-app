package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.GoodsReceiptNote;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface GoodsReceiptNoteService {

  GoodsReceiptNote create(
      UUID orgId,
      UUID branchId,
      UUID supplierId,
      UUID purchaseOrderId,
      UUID receivedByStaffUserId,
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

  record GrnLineRequest(UUID itemId, BigDecimal qty, UUID uomId, BigDecimal receivedUnitCost) {}
}
