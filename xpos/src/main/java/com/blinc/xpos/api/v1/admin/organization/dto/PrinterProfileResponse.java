package com.blinc.xpos.api.v1.admin.organization.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

public record PrinterProfileResponse(
    UUID id,
    String name,
    JsonNode configJson,
    Boolean active,
    Instant createdAt,
    Instant updatedAt) {}
