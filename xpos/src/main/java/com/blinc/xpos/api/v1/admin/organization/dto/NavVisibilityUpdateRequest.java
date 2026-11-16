package com.blinc.xpos.api.v1.admin.organization.dto;

import java.util.Map;

public record NavVisibilityUpdateRequest(
    Map<String, Boolean> admin,
    Map<String, Boolean> operator,
    Map<String, Boolean> header,
    Map<String, String> adminLabels,
    Map<String, String> operatorLabels,
    Map<String, String> headerLabels) {

  public NavVisibilityUpdateRequest {
    admin = admin != null ? admin : Map.of();
    operator = operator != null ? operator : Map.of();
    header = header != null ? header : Map.of();
    adminLabels = adminLabels != null ? adminLabels : Map.of();
    operatorLabels = operatorLabels != null ? operatorLabels : Map.of();
    headerLabels = headerLabels != null ? headerLabels : Map.of();
  }
}
