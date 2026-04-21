package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Summary of a completed historical-sales batch. */
public record SalesRecordingResponse(
    LocalDate saleDate,
    List<UUID> createdSaleIds,
    BigDecimal totalValue,
    BigDecimal totalItemsSold) {}
