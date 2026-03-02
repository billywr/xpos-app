package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.api.v1.admin.inventory.dto.InventoryReportLineResponse;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Service for inventory report: sold vs remaining (on-hand) per item, per branch.
 */
public interface InventoryReportService {

  /**
   * Returns paginated inventory report for a branch: each line has item, on-hand, sold, reserved.
   */
  Page<InventoryReportLineResponse> listByBranch(
      UUID orgId, UUID branchId, Pageable pageable);
}
