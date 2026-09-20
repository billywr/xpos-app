package com.blinc.xpos.modules.reporting.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Summary of revenue for a date range: totals, COGS, and period. */
public record RevenueSummaryResponse(
    UUID orgId,
    UUID branchId,
    LocalDate startDate,
    LocalDate endDate,
    BigDecimal revenueTotal,
    BigDecimal taxTotal,
    BigDecimal discountTotal,
    BigDecimal cogsTotal,
    BigDecimal expenseTotal,
    BigDecimal netProfit,
    int saleCount) {}
