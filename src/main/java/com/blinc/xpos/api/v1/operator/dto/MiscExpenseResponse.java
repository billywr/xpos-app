package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MiscExpenseResponse(
    UUID id,
    BigDecimal amount,
    String category,
    String description,
    String incurredBy,
    String receiptRef,
    UUID terminalId,
    UUID shiftId,
    UUID createdByStaffUserId,
    Instant createdAt) {}
