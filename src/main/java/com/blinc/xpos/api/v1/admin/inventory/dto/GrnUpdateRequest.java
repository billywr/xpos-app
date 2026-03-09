package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GrnUpdateRequest(
    @NotNull(message = "Supplier ID is required") UUID supplierId,
    @NotNull(message = "Received at is required") Instant receivedAt,
    Boolean active,
    @Valid List<GrnLineRequest> lines) {
  // When lines is null, line items are not updated. When non-null (including empty), lines are replaced.
}
