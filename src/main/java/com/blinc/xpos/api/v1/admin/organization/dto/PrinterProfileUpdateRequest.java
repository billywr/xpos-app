package com.blinc.xpos.api.v1.admin.organization.dto;

import java.util.Map;

public record PrinterProfileUpdateRequest(String name, Map<String, Object> configJson, Boolean active) {}
