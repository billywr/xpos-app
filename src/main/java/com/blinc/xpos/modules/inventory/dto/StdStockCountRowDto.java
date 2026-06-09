package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row in the Standard Stock Count Sheet. {@code openingStock} is the latest saved closing from
 * {@code std_stock_count_snapshot} with {@code business_date} strictly before the sheet date (never
 * negative); if no prior snapshot exists for the item, it is {@code 0}. {@code addedStock} is the
 * sum of {@code GrnLine} qty for active GRNs received on the sheet date only. {@code
 * addedTodayStock} is positive stock-take adjustments on the sheet date only. Frontend computes
 * totalStock (opening + addedStock + addedTodayStock), unitsSold, amount.
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
