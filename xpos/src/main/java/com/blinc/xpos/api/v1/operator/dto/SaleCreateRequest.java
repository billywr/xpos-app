package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

public record SaleCreateRequest(UUID customerId, @Valid List<SaleLineAddRequest> lines) {

  public SaleCreateRequest(UUID customerId) {
    this(customerId, List.of());
  }

  public SaleCreateRequest {
    if (lines == null) {
      lines = List.of();
    }
  }
}
