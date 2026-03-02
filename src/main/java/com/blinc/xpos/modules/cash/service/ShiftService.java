package com.blinc.xpos.modules.cash.service;

import com.blinc.xpos.modules.cash.domain.Shift;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ShiftService {

  Shift openShift(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID staffUserId,
      BigDecimal openingFloatAmount);

  Shift closeShift(
      UUID orgId,
      UUID shiftId,
      BigDecimal closingCountedAmount,
      BigDecimal expectedCashAmount,
      BigDecimal varianceAmount,
      UUID varianceReasonCodeId,
      UUID closedByManagerId);

  Optional<Shift> getCurrentOpenShift(UUID orgId, UUID branchId, UUID terminalId);

  Shift require(UUID orgId, UUID shiftId);

  /** Delegates to ShiftExpectedCashService. Exposed on ShiftService for API convenience. */
  BigDecimal computeExpectedCashForOpenShift(UUID orgId, UUID shiftId);

  Page<Shift> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  Page<Shift> listOpenByOrg(UUID orgId, Pageable pageable);
}
