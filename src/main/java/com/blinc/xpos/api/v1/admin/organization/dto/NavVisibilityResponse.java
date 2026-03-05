package com.blinc.xpos.api.v1.admin.organization.dto;

import java.util.Map;

public record NavVisibilityResponse(
    Map<String, Boolean> admin,
    Map<String, Boolean> operator) {}
