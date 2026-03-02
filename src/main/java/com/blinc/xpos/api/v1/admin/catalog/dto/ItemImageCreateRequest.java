package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.NotBlank;

public record ItemImageCreateRequest(
    @NotBlank(message = "URL is required") String url,
    int sortOrder,
    boolean isPrimary) {}
