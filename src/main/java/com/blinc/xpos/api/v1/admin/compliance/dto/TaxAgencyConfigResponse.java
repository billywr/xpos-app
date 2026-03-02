package com.blinc.xpos.api.v1.admin.compliance.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TaxAgencyConfigResponse(
    UUID id,
    UUID orgId,
    String name,
    BigDecimal vatStandardRate,
    BigDecimal vatReducedRate,
    Boolean supportsEtims,
    JsonNode etimsMappingJson,
    Instant createdAt,
    Instant updatedAt) {}
