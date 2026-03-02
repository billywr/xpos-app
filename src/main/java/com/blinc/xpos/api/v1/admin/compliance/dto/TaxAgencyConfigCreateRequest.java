package com.blinc.xpos.api.v1.admin.compliance.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record TaxAgencyConfigCreateRequest(
    @NotBlank(message = "Name is required") @Size(max = 200) String name,
    @NotNull(message = "VAT standard rate is required") BigDecimal vatStandardRate,
    @NotNull(message = "VAT reduced rate is required") BigDecimal vatReducedRate,
    @NotNull(message = "supportsEtims is required") Boolean supportsEtims,
    JsonNode etimsMappingJson) {}
