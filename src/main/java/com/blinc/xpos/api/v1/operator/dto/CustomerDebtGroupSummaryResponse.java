package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;

public record CustomerDebtGroupSummaryResponse(
    String groupKey,
    String groupLabel,
    long count,
    BigDecimal totalAmount,
    BigDecimal totalAmountSettled,
    BigDecimal totalOutstanding,
    String customerPhone) {}
