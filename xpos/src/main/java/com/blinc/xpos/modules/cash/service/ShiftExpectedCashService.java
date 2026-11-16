package com.blinc.xpos.modules.cash.service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Computes expected cash in drawer for an open shift. Separated from ShiftService to avoid circular
 * dependency with CashMovementService.
 */
public interface ShiftExpectedCashService {

  /**
   * Computes expected cash: opening float + cash tenders + PAID_IN - PAID_OUT. Returns null if
   * shift is closed or not found.
   */
  BigDecimal computeForOpenShift(UUID orgId, UUID shiftId);
}
