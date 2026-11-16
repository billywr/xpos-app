package com.blinc.xpos.api.v1.admin.compliance.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record TaxAgencyConfigUpdateRequest(
    @Size(max = 200) String name,
    BigDecimal vatStandardRate,
    BigDecimal vatReducedRate,
    Boolean supportsEtims,
    JsonNode etimsMappingJson) {}
