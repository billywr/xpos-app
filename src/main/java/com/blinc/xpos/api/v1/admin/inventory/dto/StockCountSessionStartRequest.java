package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record StockCountSessionStartRequest(
    @NotNull(message = "Branch ID is required") UUID branchId) {}
