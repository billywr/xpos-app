package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row in the Standard Stock Count Sheet. {@code openingStock} is the effective carry-forward
 * from the latest meaningful {@code std_stock_count_snapshot} before the sheet date: when saved
 * {@code closing_qty} still equals that day's opening but same-day receipts exist, opening uses the
 * day total (opening + added); when saved closing is below day total but above opening (sales after
 * receipts), opening uses saved closing; otherwise saved closing plus GRN lines created after
 * {@code last_saved_at} (never negative). If no prior snapshot exists for the item, it is {@code
 * 0}. {@code addedStock} is the sum of {@code GrnLine} qty for active GRNs received on the sheet
 * date only. {@code addedTodayStock} is positive stock-take adjustments on the sheet date only.
 * {@code firstStockAddedAt} is the earliest GRN line {@code createdAt} or positive stock-take
 * adjust timestamp for the item on the sheet date (null when no stock was added). {@code
 * latestStockAddedAt} is the latest GRN line {@code createdAt} or positive stock-take adjust
 * timestamp for the item on the sheet date (null when no stock was added). Frontend computes
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
    Instant firstStockAddedAt,
    Instant latestStockAddedAt,
    String comments) {

  public StdStockCountRowDto(
      UUID itemId,
      String sku,
      String name,
      BigDecimal openingStock,
      BigDecimal addedStock,
      BigDecimal addedTodayStock,
      BigDecimal sellingPrice,
      BigDecimal closingStock,
      Instant lastSavedAt,
      Instant firstStockAddedAt,
      String comments) {
    this(
        itemId,
        sku,
        name,
        openingStock,
        addedStock,
        addedTodayStock,
        sellingPrice,
        closingStock,
        lastSavedAt,
        firstStockAddedAt,
        firstStockAddedAt,
        comments);
  }
}
