package com.blinc.xpos.modules.cash.dto;

import java.math.BigDecimal;

public record ExpenseGroupSummaryProjection(
    String groupKey, String groupLabel, long count, BigDecimal totalAmount) {}
