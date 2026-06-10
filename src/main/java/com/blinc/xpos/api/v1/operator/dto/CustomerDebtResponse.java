package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CustomerDebtResponse(
    UUID id,
    UUID customerId,
    String customerName,
    String customerPhone,
    UUID saleId,
    BigDecimal amount,
    BigDecimal amountSettled,
    BigDecimal outstanding,
    String currency,
    LocalDate dueDate,
    String status,
    String notes,
    String issuedBy,
    UUID createdByStaffUserId,
    Instant createdAt) {}
