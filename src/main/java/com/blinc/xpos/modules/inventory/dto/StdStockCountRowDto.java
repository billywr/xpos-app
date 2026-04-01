package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row in the Standard Stock Count Sheet. {@code openingStock} is the previous branch business
 * day's saved closing from {@code std_stock_count_snapshot} when present (never negative); if
 * missing, {@code max(0, systemCountBeforeToday − addedStock − addedTodayStock)}. {@code
 * addedStock} is same-day receipts only: sum of {@code GrnLine} qty for active GRNs whose {@code
 * receivedAt} is on that date. {@code addedTodayStock} is positive stock-take adjustments (e.g.
 * session close variance). {@code systemCountBeforeToday} is ledger at end of that branch day.
 * Frontend computes totalStock (opening + addedStock + addedTodayStock), unitsSold, amount,
 * variance (Closing − systemCountBeforeToday).
 */
public record StdStockCountRowDto(
    UUID itemId,
    String sku,
    String name,
    int openingStock,
    int addedStock,
    int addedTodayStock,
    int systemCountBeforeToday,
    BigDecimal sellingPrice,
    Integer closingStock,
    Instant lastSavedAt,
    String comments) {}
