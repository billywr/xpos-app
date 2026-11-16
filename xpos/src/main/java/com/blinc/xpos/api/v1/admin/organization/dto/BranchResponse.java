package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

public record BranchResponse(
    UUID id,
    UUID orgId,
    UUID businessId,
    String name,
    String timezone,
    String currency,
    JsonNode addressJson,
    UUID taxAgencyConfigId,
    UUID receiptTemplateId,
    StatusCommon status,
    Instant createdAt,
    Instant updatedAt) {}
