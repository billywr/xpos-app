package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Dashboard metrics for a business date on the Sales Recording screen. */
public record SalesRecordingStatsResponse(
    LocalDate saleDate,
    BigDecimal totalSalesValue,
    BigDecimal totalItemsSold,
    int saleCount,
    List<TopSellingItem> topSellingItems,
    List<LowStockItem> lowStockItems,
    List<ItemSoldQty> soldByItem) {

  public record TopSellingItem(
      UUID itemId, String itemName, BigDecimal qtySold, BigDecimal totalValue) {}

  public record LowStockItem(UUID itemId, String itemName, BigDecimal onHandQty) {}

  public record ItemSoldQty(UUID itemId, BigDecimal qtySold, BigDecimal totalValue) {}
}
