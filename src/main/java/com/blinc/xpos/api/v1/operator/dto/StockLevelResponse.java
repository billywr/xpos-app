package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record StockLevelResponse(UUID itemId, BigDecimal onHandQty) {}
