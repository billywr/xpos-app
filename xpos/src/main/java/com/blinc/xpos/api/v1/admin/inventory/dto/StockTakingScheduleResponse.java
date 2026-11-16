package com.blinc.xpos.api.v1.admin.inventory.dto;

import java.time.Instant;
import java.util.UUID;

public record StockTakingScheduleResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String frequency,
    Integer dayOfWeek,
    int scheduledHour,
    int scheduledMinute,
    boolean isActive,
    Instant lastRunAt,
    Instant createdAt,
    Instant updatedAt) {}
