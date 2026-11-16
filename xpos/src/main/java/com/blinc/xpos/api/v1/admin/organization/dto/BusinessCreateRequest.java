package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotBlank;

public record BusinessCreateRequest(
    @NotBlank(message = "Legal name is required") String legalName,
    String kraPin,
    String logoUrl,
    String receiptFooter) {}
