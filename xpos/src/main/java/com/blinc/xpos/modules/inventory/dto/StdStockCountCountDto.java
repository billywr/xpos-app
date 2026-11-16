package com.blinc.xpos.modules.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

public record StdStockCountCountDto(
    @NotNull UUID itemId,
    @NotNull @DecimalMin("0") BigDecimal closingStock,
    Optional<String> comments) {}
