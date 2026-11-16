package com.blinc.xpos.api.v1.admin.organization.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record TerminalCreateRequest(
    @NotBlank(message = "Terminal code is required") String terminalCode, UUID printerProfileId) {}
