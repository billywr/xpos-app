package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record StdStockCountSalesPreviewDto(
    LocalDate date,
    UUID branchId,
    List<StdStockCountSalesLineDto> lines,
    BigDecimal totalQtyToRecord,
    BigDecimal totalValueToRecord) {}
