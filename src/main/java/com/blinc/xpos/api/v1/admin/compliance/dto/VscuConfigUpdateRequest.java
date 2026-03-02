package com.blinc.xpos.api.v1.admin.compliance.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import java.util.Map;

public record VscuConfigUpdateRequest(Map<String, Object> configJson, StatusCommon status) {}
