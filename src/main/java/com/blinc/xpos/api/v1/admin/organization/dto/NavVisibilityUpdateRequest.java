package com.blinc.xpos.api.v1.admin.organization.dto;

import java.util.Map;

public record NavVisibilityUpdateRequest(
    Map<String, Boolean> admin,
    Map<String, Boolean> operator) {

  public NavVisibilityUpdateRequest {
    admin = admin != null ? admin : Map.of();
    operator = operator != null ? operator : Map.of();
  }
}
