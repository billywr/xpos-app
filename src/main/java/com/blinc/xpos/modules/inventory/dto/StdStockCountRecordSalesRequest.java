package com.blinc.xpos.modules.inventory.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record StdStockCountRecordSalesRequest(
    @NotNull(message = "Date is required") LocalDate date,
    @NotNull(message = "Terminal is required") UUID terminalId) {}
