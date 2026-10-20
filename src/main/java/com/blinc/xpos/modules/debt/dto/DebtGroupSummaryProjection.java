package com.blinc.xpos.modules.debt.dto;

import java.math.BigDecimal;

public record DebtGroupSummaryProjection(
    String groupKey,
    String groupLabel,
    long count,
    BigDecimal totalAmount,
    BigDecimal totalAmountSettled,
    BigDecimal totalOutstanding,
    String customerPhone) {}
