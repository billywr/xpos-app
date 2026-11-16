package com.blinc.xpos.modules.inventory.repository;

import java.util.UUID;

/** Org/branch pair for std stock count auto-sync scheduler iteration. */
public interface BranchSnapshotTarget {

  UUID getOrgId();

  UUID getBranchId();
}
