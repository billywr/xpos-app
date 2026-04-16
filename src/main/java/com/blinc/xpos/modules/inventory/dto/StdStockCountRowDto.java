package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row in the Standard Stock Count Sheet. {@code openingStock} is strictly the previous branch
 * business day's saved closing from {@code std_stock_count_snapshot} (never negative); if no
 * snapshot exists for the previous business day, it is {@code 0}. {@code addedStock} is same-day
 * receipts only: sum of {@code GrnLine} qty for active GRNs whose {@code receivedAt} is on that
 * date. {@code addedTodayStock} is positive stock-take adjustments (e.g. session close variance).
 * Frontend computes totalStock (opening + addedStock + addedTodayStock), unitsSold, amount.
 */
public record StdStockCountRowDto(
    UUID itemId,
    String sku,
    String name,
    BigDecimal openingStock,
    BigDecimal addedStock,
    BigDecimal addedTodayStock,
    BigDecimal sellingPrice,
    BigDecimal closingStock,
    Instant lastSavedAt,
    String comments) {}
