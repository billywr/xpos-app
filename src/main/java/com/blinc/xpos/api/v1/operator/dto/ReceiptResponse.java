package com.blinc.xpos.api.v1.operator.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ReceiptResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID terminalId,
    LocalDate businessDate,
    Long receiptNumber,
    Instant printedAt,
    Integer reprintCount,
    Instant createdAt) {}
