package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Request body for recording a batch of historical sales on a single business date. Each entry
 * becomes its own Sale (status=COMPLETED) with exactly one SaleLine and an implicit cash tender
 * equal to the line total.
 */
public record SalesRecordingRequest(
    @NotNull LocalDate saleDate, @NotEmpty @Valid List<Entry> entries) {

  public record Entry(
      @NotNull UUID itemId,
      @NotNull @DecimalMin(value = "0.01", message = "Quantity must be at least 0.01")
          BigDecimal qty) {}
}
