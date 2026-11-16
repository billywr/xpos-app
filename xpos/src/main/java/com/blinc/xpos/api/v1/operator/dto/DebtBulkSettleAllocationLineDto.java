package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record DebtBulkSettleAllocationLineDto(
    UUID debtId,
    BigDecimal appliedAmount,
    BigDecimal outstandingBefore,
    BigDecimal outstandingAfter,
    String status) {}
