package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ShiftCloseRequest(
    BigDecimal closingCountedAmount,
    BigDecimal expectedCashAmount,
    BigDecimal varianceAmount,
    UUID varianceReasonCodeId,
    UUID closedByManagerId) {}
