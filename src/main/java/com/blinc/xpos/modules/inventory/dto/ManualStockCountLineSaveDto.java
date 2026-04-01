package com.blinc.xpos.modules.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record ManualStockCountLineSaveDto(
    UUID itemId,
    @NotBlank @Size(max = 512) String itemName,
    @Size(max = 128) String sku,
    /** When null on save, opening defaults to previous business day's saved closing. */
    Integer openingQty,
    @NotNull @Min(0) Integer addedQty,
    @NotNull @Min(0) Integer addedTodayQty,
    Integer closingQty,
    Integer systemQty,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal sellingPrice,
    @Size(max = 2000) String comments,
    Integer lineOrder) {}
