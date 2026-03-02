package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TransferOrderResponse(
    UUID id,
    UUID orgId,
    UUID fromBranchId,
    UUID toBranchId,
    String status,
    Instant createdAt,
    Instant updatedAt,
    List<TransferOrderLineResponse> lines) {}
