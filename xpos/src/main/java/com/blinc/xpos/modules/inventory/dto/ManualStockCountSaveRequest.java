package com.blinc.xpos.modules.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ManualStockCountSaveRequest(
    @NotNull LocalDate date,
    @NotNull UUID outletId,
    @NotNull @Valid List<ManualStockCountLineSaveDto> rows) {}
