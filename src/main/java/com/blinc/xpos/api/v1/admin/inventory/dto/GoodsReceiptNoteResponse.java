package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GoodsReceiptNoteResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID supplierId,
    String supplierName,
    UUID purchaseOrderId,
    UUID receivedByStaffUserId,
    Instant receivedAt,
    Instant createdAt,
    Boolean active,
    List<GrnLineResponse> lines) {}
