package com.blinc.xpos.api.v1.admin.organization.dto;

import java.util.Map;

public record NavVisibilityResponse(
    Map<String, Boolean> admin,
    Map<String, Boolean> operator,
    Map<String, Boolean> header,
    Map<String, String> adminLabels,
    Map<String, String> operatorLabels,
    Map<String, String> headerLabels) {}
