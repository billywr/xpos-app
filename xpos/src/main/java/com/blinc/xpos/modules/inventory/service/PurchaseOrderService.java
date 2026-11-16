package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.PurchaseOrder;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PurchaseOrderService {

  String STATUS_DRAFT = "DRAFT";
  String STATUS_SUBMITTED = "SUBMITTED";
  String STATUS_RECEIVED = "RECEIVED";
  String STATUS_CANCELLED = "CANCELLED";

  PurchaseOrder create(UUID orgId, UUID branchId, UUID supplierId, UUID createdByStaffUserId);

  PurchaseOrder require(UUID orgId, UUID purchaseOrderId);

  Page<PurchaseOrder> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  PurchaseOrder addLine(
      UUID orgId,
      UUID purchaseOrderId,
      UUID itemId,
      BigDecimal qty,
      UUID uomId,
      BigDecimal expectedUnitCost);
}
