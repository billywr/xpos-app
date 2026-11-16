package com.blinc.xpos.api.v1.admin.staff.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record StaffProfileUpsertRequest(
    @Size(max = 200, message = "displayName must be at most 200 characters") String displayName,
    @Size(max = 50, message = "phone must be at most 50 characters") String phone,
    @Email(message = "email must be a valid email address")
        @Size(max = 254, message = "email must be at most 254 characters")
        String email,
    @Size(max = 50, message = "employeeNo must be at most 50 characters") String employeeNo,
    UUID defaultBranchId,
    StatusCommon status) {}
