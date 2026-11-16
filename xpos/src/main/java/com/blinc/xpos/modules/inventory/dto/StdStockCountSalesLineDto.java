package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record StdStockCountSalesLineDto(
    UUID itemId,
    String name,
    BigDecimal impliedSold,
    BigDecimal alreadyRecorded,
    BigDecimal qtyToRecord,
    BigDecimal qtyRecorded,
    BigDecimal unitPrice,
    BigDecimal lineValue,
    StdStockCountSalesLineStatus status) {}
