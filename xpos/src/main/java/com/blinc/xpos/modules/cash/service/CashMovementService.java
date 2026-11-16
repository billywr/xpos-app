package com.blinc.xpos.modules.cash.service;

import com.blinc.xpos.common.constants.enums.CashMovementType;
import com.blinc.xpos.modules.cash.domain.CashMovement;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CashMovementService {

  CashMovement create(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID shiftId,
      CashMovementType type,
      BigDecimal amount,
      UUID reasonCodeId,
      UUID createdByStaffUserId);

  CashMovement require(UUID orgId, UUID cashMovementId);

  List<CashMovement> listByShift(UUID orgId, UUID shiftId);

  Page<CashMovement> listByBranch(UUID orgId, UUID branchId, Pageable pageable);
}
