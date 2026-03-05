package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row in the Standard Stock Count Sheet. Backend provides opening, added, systemCountBeforeToday,
 * price, closing (if previously saved). Frontend computes totalStock, unitsSold, amount, variance.
 */
public record StdStockCountRowDto(
    UUID itemId,
    String sku,
    String name,
    int openingStock,
    int addedStock,
    int systemCountBeforeToday,
    BigDecimal sellingPrice,
    Integer closingStock,
    Instant lastSavedAt) {}
