package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import jakarta.validation.constraints.NotBlank;

public record BusinessUpdateRequest(
    @NotBlank(message = "Legal name is required") String legalName,
    String kraPin,
    String logoUrl,
    String receiptFooter,
    StatusCommon status) {}
