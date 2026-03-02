package com.blinc.xpos.api.v1.admin.ledger.dto;

import java.time.Instant;
import java.util.UUID;

public record PostingRuleResponse(
    UUID id,
    UUID orgId,
    String eventType,
    String debitAccountCode,
    String creditAccountCode,
    Boolean active,
    Instant createdAt,
    Instant updatedAt) {}
