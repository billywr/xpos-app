package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ShiftResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID terminalId,
    UUID staffUserId,
    Instant openedAt,
    Instant closedAt,
    String status,
    BigDecimal openingFloatAmount,
    BigDecimal closingCountedAmount,
    BigDecimal expectedCashAmount,
    BigDecimal varianceAmount,
    UUID closedByManagerId,
    UUID varianceReasonCodeId) {}
