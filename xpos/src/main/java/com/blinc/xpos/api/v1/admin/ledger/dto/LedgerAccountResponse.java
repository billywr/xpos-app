package com.blinc.xpos.api.v1.admin.ledger.dto;

import com.blinc.xpos.common.constants.enums.LedgerAccountType;
import java.time.Instant;
import java.util.UUID;

public record LedgerAccountResponse(
    UUID id,
    UUID orgId,
    String code,
    String name,
    LedgerAccountType accountType,
    Boolean active,
    Instant createdAt) {}
