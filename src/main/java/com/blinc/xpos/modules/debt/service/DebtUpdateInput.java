package com.blinc.xpos.modules.debt.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Partial update payload for {@link CustomerDebtService#update}. Null fields mean "leave
 * unchanged".
 */
public record DebtUpdateInput(
    UUID reassignedCustomerId,
    String customerName,
    String customerPhone,
    BigDecimal amount,
    BigDecimal outstanding,
    LocalDate dueDate,
    String notes) {}
