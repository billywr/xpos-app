package com.blinc.xpos.api.v1.admin.sales.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SaleSummaryResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID terminalId,
    Long receiptNumber,
    String status,
    BigDecimal total,
    UUID createdByStaffUserId,
    String createdByUsername,
    Instant completedAt,
    Instant createdAt) {}
