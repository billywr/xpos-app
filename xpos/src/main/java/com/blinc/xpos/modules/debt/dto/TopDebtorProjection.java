package com.blinc.xpos.modules.debt.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** Customer ranked by outstanding debt balance at a branch. */
public record TopDebtorProjection(
    UUID customerId, String customerName, BigDecimal outstandingAmount) {}
