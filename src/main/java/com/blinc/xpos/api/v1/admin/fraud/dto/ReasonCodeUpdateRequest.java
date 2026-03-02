package com.blinc.xpos.api.v1.admin.fraud.dto;

import jakarta.validation.constraints.Size;

public record ReasonCodeUpdateRequest(
    @Size(max = 500) String description,
    Boolean active) {}
