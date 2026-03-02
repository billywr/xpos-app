package com.blinc.xpos.api.v1.operator.dto;

import java.util.UUID;

public record SaleCreateRequest(UUID customerId, UUID priceListId) {

  public SaleCreateRequest {
    // compact constructor for validation if needed
  }
}
