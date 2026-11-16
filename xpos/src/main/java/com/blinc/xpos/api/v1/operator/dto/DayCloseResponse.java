package com.blinc.xpos.api.v1.operator.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record DayCloseResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    LocalDate businessDate,
    String status,
    UUID closedBy,
    Instant closedAt,
    Instant createdAt) {}
