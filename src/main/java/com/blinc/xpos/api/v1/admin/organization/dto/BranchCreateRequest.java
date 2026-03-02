package com.blinc.xpos.api.v1.admin.organization.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record BranchCreateRequest(
    @NotNull(message = "Business id is required") UUID businessId,
    @NotBlank(message = "Branch name is required") String name,
    String timezone,
    String currency,
    JsonNode addressJson,
    UUID taxAgencyConfigId,
    UUID receiptTemplateId) {}
