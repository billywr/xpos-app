package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record CategoryCreateRequest(
    UUID parentId,
    @NotBlank(message = "Name is required") String name,
    @NotBlank(message = "Type is required") String type) {}
