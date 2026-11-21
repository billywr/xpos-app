package com.blinc.xpos.api.v1.operator.dto;

import com.blinc.xpos.modules.cash.domain.RecurringUtilityApplyTiming;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RecurringUtilityResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    String name,
    BigDecimal amount,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    RecurringUtilityApplyTiming applyTiming,
    int dueDayOfMonth,
    String payee,
    String accountNumber,
    String incurredBy,
    String notes,
    boolean active,
    UUID createdByStaffUserId,
    String createdByStaffUserName,
    Instant createdAt,
    Instant updatedAt) {}
