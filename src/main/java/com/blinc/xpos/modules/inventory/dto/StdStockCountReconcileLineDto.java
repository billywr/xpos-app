package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record StdStockCountReconcileLineDto(
    UUID itemId, String name, BigDecimal closingStock, BigDecimal onHandQty, BigDecimal variance) {}
