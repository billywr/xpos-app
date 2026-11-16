package com.blinc.xpos.modules.mpesa.dto;

import jakarta.validation.constraints.NotNull;

public record MpesaOperatorSettingsUpdateRequest(
    @NotNull(message = "stkOperatorEnabled is required") Boolean stkOperatorEnabled) {}
