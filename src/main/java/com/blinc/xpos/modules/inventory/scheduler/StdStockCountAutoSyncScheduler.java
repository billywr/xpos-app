package com.blinc.xpos.modules.inventory.scheduler;

import com.blinc.xpos.modules.inventory.repository.BranchSnapshotTarget;
import com.blinc.xpos.modules.inventory.repository.StdStockCountSnapshotRepository;
import com.blinc.xpos.modules.inventory.service.StdStockCountService;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Persists std stock count carry-forward closings on a schedule so snapshots exist even when no
 * operator opens the std stock count page.
 */
@Component
public class StdStockCountAutoSyncScheduler {

  private static final Logger log = LoggerFactory.getLogger(StdStockCountAutoSyncScheduler.class);

  private final StdStockCountSnapshotRepository snapshotRepository;
  private final StdStockCountService stdStockCountService;

  @Value("${xpos.std-stock-count.auto-sync.enabled:true}")
  private boolean enabled;

  public StdStockCountAutoSyncScheduler(
      StdStockCountSnapshotRepository snapshotRepository,
      StdStockCountService stdStockCountService) {
    this.snapshotRepository = Objects.requireNonNull(snapshotRepository, "snapshotRepository");
    this.stdStockCountService =
        Objects.requireNonNull(stdStockCountService, "stdStockCountService");
  }

  @Scheduled(cron = "${xpos.std-stock-count.auto-sync.cron:0 */15 * * * ?}")
  public void autoSyncCarryForwardForAllBranches() {
    if (!enabled) {
      return;
    }
    List<BranchSnapshotTarget> targets =
        snapshotRepository.findDistinctActiveBranchesWithSnapshots();
    for (BranchSnapshotTarget target : targets) {
      try {
        var result =
            stdStockCountService.autoSyncCarryForward(target.getOrgId(), target.getBranchId());
        if (result.rowsSynced() > 0) {
          log.info(
              "Std stock count auto-sync for branch {}: {} row(s) on {}",
              target.getBranchId(),
              result.rowsSynced(),
              result.date());
        }
      } catch (Exception e) {
        log.warn(
            "Std stock count auto-sync failed for branch {}: {}",
            target.getBranchId(),
            e.getMessage(),
            e);
      }
    }
  }
}
