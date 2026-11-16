package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record TransferOrderCreateRequest(
    @NotNull(message = "From branch ID is required") UUID fromBranchId,
    @NotNull(message = "To branch ID is required") UUID toBranchId) {}
