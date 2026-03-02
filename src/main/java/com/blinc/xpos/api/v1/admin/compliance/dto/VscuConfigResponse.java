package com.blinc.xpos.api.v1.admin.compliance.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

public record VscuConfigResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    JsonNode configJson,
    StatusCommon status,
    Instant createdAt,
    Instant updatedAt) {}
