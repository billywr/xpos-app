package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PurchaseOrderResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID supplierId,
    String supplierName,
    String status,
    UUID createdByStaffUserId,
    Instant createdAt,
    Instant updatedAt,
    List<PurchaseOrderLineResponse> lines) {}
