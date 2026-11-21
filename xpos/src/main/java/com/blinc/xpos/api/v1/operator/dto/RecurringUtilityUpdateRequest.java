package com.blinc.xpos.api.v1.operator.dto;

import com.blinc.xpos.modules.cash.domain.RecurringUtilityApplyTiming;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record RecurringUtilityUpdateRequest(
    @Size(max = 150) String name,
    @DecimalMin(value = "0.01", message = "Amount must be positive") BigDecimal amount,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    Boolean isRateChange,
    RecurringUtilityApplyTiming applyTiming,
    @Min(value = 1, message = "Due day of month must be between 1 and 31")
        @Max(value = 31, message = "Due day of month must be between 1 and 31")
        Integer dueDayOfMonth,
    @Size(max = 255) String payee,
    @Size(max = 100) String accountNumber,
    @Size(max = 150) String incurredBy,
    Boolean active,
    String notes) {}
