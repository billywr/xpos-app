package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CashMovementResponse(
    UUID id,
    UUID shiftId,
    String type,
    BigDecimal amount,
    UUID reasonCodeId,
    UUID createdByStaffUserId,
    Instant createdAt) {}
