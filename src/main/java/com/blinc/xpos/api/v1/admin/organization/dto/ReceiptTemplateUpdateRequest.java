package com.blinc.xpos.api.v1.admin.organization.dto;

import java.util.Map;

public record ReceiptTemplateUpdateRequest(String name, Map<String, Object> templateJson, Boolean active) {}
