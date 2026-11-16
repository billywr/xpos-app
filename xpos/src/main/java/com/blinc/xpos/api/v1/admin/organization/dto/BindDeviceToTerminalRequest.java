package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record BindDeviceToTerminalRequest(
    @NotNull(message = "Device registration id is required") UUID deviceRegistrationId) {}
