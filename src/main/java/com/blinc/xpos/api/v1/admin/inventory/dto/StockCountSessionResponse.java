package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StockCountSessionResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String status,
    UUID startedByStaffUserId,
    Instant startedAt,
    Instant closedAt,
    List<StockCountLineResponse> lines) {}
