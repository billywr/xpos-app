package com.blinc.xpos.api.v1.operator.dto;

import com.blinc.xpos.common.constants.enums.CashMovementType;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record CashMovementCreateRequest(
    @NotNull(message = "Type is required") CashMovementType type,
    @NotNull(message = "Amount is required") BigDecimal amount,
    UUID reasonCodeId) {}
