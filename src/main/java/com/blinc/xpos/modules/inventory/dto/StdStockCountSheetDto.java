package com.blinc.xpos.modules.inventory.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record StdStockCountSheetDto(
    LocalDate date, UUID outletId, List<StdStockCountRowDto> rows) {}
