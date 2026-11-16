package com.blinc.xpos.modules.inventory.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record StdStockCountReconcilePreviewDto(
    LocalDate date,
    UUID branchId,
    List<StdStockCountReconcileLineDto> lines,
    int itemsAdjusted,
    int itemsAlreadyMatched) {}
