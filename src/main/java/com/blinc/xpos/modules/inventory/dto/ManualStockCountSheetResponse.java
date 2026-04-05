package com.blinc.xpos.modules.inventory.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ManualStockCountSheetResponse(
    LocalDate date, UUID outletId, Instant lastSavedAt, List<ManualStockCountLineResponse> rows) {}
