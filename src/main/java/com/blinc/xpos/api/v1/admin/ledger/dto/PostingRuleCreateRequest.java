package com.blinc.xpos.api.v1.admin.ledger.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PostingRuleCreateRequest(
    @NotBlank(message = "Event type is required") @Size(max = 100) String eventType,
    @NotBlank(message = "Debit account code is required") @Size(max = 50) String debitAccountCode,
    @NotBlank(message = "Credit account code is required") @Size(max = 50) String creditAccountCode) {}
