package com.blinc.xpos.api.v1.admin.pricing.dto;

import java.time.Instant;
import java.util.UUID;

public record PriceScheduleResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String name,
    String startsAt,
    String endsAt,
    int daysOfWeek,
    Instant createdAt,
    Instant updatedAt) {}
