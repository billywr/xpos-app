package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;

public record MiscExpenseGroupSummaryResponse(
    String groupKey, String groupLabel, long count, BigDecimal totalAmount) {}
