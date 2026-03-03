package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import com.blinc.xpos.modules.inventory.domain.StockTakingSchedule;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StockTakingScheduleService {

  StockTakingSchedule create(
      UUID orgId,
      UUID branchId,
      String frequency,
      Integer dayOfWeek,
      int scheduledHour,
      int scheduledMinute);

  StockTakingSchedule require(UUID orgId, UUID scheduleId);

  StockTakingSchedule update(
      UUID orgId,
      UUID scheduleId,
      String frequency,
      Integer dayOfWeek,
      int scheduledHour,
      int scheduledMinute,
      boolean isActive);

  Page<StockTakingSchedule> listByOrg(UUID orgId, Pageable pageable);

  StockTakingSchedule getByBranch(UUID orgId, UUID branchId);

  void delete(UUID orgId, UUID scheduleId);

  /**
   * Manually trigger a stock count session for this schedule now. Creates an open session
   * immediately (industry standard: run-on-demand). Updates lastRunAt for idempotency.
   */
  StockCountSession trigger(UUID orgId, UUID scheduleId, UUID triggeredByStaffUserId);
}
