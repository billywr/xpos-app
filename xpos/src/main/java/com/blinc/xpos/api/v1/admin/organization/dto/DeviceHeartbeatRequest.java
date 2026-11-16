package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotBlank;

public record DeviceHeartbeatRequest(
    @NotBlank(message = "Device fingerprint is required") String deviceFingerprint) {}
