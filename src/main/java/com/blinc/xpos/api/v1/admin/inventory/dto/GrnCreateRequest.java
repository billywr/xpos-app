package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record GrnCreateRequest(
    @NotNull(message = "Branch ID is required") UUID branchId,
    @NotNull(message = "Supplier ID is required") UUID supplierId,
    UUID purchaseOrderId,
    @Valid List<GrnLineRequest> lines) {

  public GrnCreateRequest {
    if (lines == null) {
      lines = List.of();
    }
  }
}
