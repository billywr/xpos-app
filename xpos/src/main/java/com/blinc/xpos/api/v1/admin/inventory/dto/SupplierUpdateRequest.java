package com.blinc.xpos.api.v1.admin.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierUpdateRequest(
    @NotBlank(message = "Name is required") @Size(max = 200) String name,
    @Size(max = 50) String phone,
    @Size(max = 200) String email,
    Boolean active) {}
