package com.blinc.xpos.modules.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record StdStockCountSaveRequest(
    @NotNull LocalDate date,
    @NotNull UUID outletId,
    @NotEmpty @Valid List<StdStockCountCountDto> counts) {}
