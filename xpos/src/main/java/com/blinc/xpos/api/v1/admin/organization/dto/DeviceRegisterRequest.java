package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotBlank;

public record DeviceRegisterRequest(
    @NotBlank(message = "Device id is required") String deviceId, String deviceFingerprint) {}
