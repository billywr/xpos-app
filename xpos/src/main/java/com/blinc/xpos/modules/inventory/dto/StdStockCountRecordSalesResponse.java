package com.blinc.xpos.modules.inventory.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record StdStockCountRecordSalesResponse(
    LocalDate date,
    UUID terminalId,
    BigDecimal totalItemsRecorded,
    BigDecimal totalValue,
    List<UUID> saleIds,
    List<StdStockCountSalesLineDto> lines) {}
