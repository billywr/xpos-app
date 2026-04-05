package com.blinc.xpos.modules.reporting.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One data point in the revenue trend: daily totals. */
public record RevenueTrendPointResponse(
    LocalDate date, BigDecimal revenue, BigDecimal tax, BigDecimal cogs, int saleCount) {}
