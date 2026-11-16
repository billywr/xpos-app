package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SaleLineModifierResponse(
    UUID id,
    UUID modifierOptionId,
    String modifierOptionName,
    BigDecimal qty,
    BigDecimal priceDelta) {}
