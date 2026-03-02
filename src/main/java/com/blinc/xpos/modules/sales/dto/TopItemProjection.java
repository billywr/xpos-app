package com.blinc.xpos.modules.sales.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** Projection for top-selling items by revenue in a date range. */
public record TopItemProjection(UUID itemId, String itemName, BigDecimal totalQty, BigDecimal totalRevenue) {}
