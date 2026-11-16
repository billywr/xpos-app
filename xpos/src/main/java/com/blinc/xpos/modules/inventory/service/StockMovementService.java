package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.StockMovement;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StockMovementService {

  StockMovement require(UUID orgId, UUID stockMovementId);

  Page<StockMovement> listByBranch(UUID orgId, UUID branchId, Pageable pageable);
}
