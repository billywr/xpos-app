package com.blinc.xpos.modules.inventory.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record StdStockCountReconcileRequest(@NotNull LocalDate date, @NotNull UUID outletId) {}
