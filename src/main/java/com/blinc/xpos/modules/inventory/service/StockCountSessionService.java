package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.StockCountSession;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StockCountSessionService {

  String STATUS_OPEN = "OPEN";
  String STATUS_CLOSED = "CLOSED";

  StockCountSession start(UUID orgId, UUID branchId, UUID startedByStaffUserId);

  StockCountSession startScheduled(
      UUID orgId, UUID branchId, UUID scheduleId, UUID startedByStaffUserId);

  StockCountSession require(UUID orgId, UUID sessionId);

  Page<StockCountSession> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  StockCountSession addLine(
      UUID orgId, UUID sessionId, UUID itemId, BigDecimal countedQty);

  StockCountSession close(UUID orgId, UUID sessionId, UUID closedByStaffUserId);
}
