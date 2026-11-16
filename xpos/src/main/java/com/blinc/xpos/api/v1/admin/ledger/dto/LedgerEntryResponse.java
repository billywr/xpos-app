package com.blinc.xpos.api.v1.admin.ledger.dto;

import com.blinc.xpos.common.constants.enums.DebitCredit;
import com.blinc.xpos.common.constants.enums.SourceType;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record LedgerEntryResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    LocalDate businessDate,
    SourceType sourceType,
    UUID sourceId,
    UUID accountId,
    String accountCode,
    DebitCredit direction,
    BigDecimal amount,
    String currency,
    Instant createdAt) {}
