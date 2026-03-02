package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record BranchUpdateRequest(
    @NotBlank(message = "Branch name is required") String name,
    String timezone,
    String currency,
    JsonNode addressJson,
    UUID taxAgencyConfigId,
    UUID receiptTemplateId,
    StatusCommon status) {}
