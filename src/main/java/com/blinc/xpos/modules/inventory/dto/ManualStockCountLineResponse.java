package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** One manual sheet row with computed total, units sold, variance, amount. */
public record ManualStockCountLineResponse(
    UUID id,
    UUID itemId,
    String itemName,
    String sku,
    int openingQty,
    int addedQty,
    int addedTodayQty,
    int totalStock,
    Integer closingQty,
    Integer systemQty,
    Integer variance,
    int unitsSold,
    BigDecimal sellingPrice,
    BigDecimal amount,
    String comments,
    int lineOrder) {}
