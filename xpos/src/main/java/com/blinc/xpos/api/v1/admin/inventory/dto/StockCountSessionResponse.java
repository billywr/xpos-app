package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StockCountSessionResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String status,
    String sourceType,
    UUID scheduleId,
    UUID startedByStaffUserId,
    Instant startedAt,
    UUID closedByStaffUserId,
    Instant closedAt,
    List<StockCountLineResponse> lines) {}
