package com.blinc.xpos.api.v1.admin.ledger.dto;

import com.blinc.xpos.common.constants.enums.LedgerAccountType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record LedgerAccountCreateRequest(
    @NotBlank(message = "Code is required") @Size(max = 50) String code,
    @NotBlank(message = "Name is required") @Size(max = 200) String name,
    @NotNull(message = "Account type is required") LedgerAccountType accountType) {}
