package com.blinc.xpos.modules.cash.service;

import com.blinc.xpos.modules.cash.domain.DayClose;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface DayCloseService {

  DayClose closeDay(
      UUID orgId, UUID branchId, LocalDate businessDate, UUID closedByStaffUserId);

  DayClose require(UUID orgId, UUID dayCloseId);

  Optional<DayClose> findByBranchAndDate(UUID orgId, UUID branchId, LocalDate businessDate);

  Page<DayClose> listByBranch(UUID orgId, UUID branchId, Pageable pageable);
}
