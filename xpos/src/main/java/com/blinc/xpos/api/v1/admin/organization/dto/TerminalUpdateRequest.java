package com.blinc.xpos.api.v1.admin.organization.dto;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record TerminalUpdateRequest(
    @NotBlank(message = "Terminal code is required") String terminalCode,
    UUID deviceRegistrationId,
    UUID printerProfileId,
    StatusCommon status) {}
