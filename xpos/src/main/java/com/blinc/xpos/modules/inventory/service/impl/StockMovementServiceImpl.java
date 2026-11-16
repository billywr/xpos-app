package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.inventory.domain.StockMovement;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.StockMovementService;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StockMovementServiceImpl implements StockMovementService {

  private final StockMovementRepository stockMovementRepository;
  private final BranchService branchService;

  public StockMovementServiceImpl(
      StockMovementRepository stockMovementRepository, BranchService branchService) {
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
  }

  @Override
  @Transactional(readOnly = true)
  public StockMovement require(UUID orgId, UUID stockMovementId) {
    return stockMovementRepository
        .findByIdAndOrgId(stockMovementId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "STOCK_MOVEMENT_NOT_FOUND", "Stock movement not found: " + stockMovementId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<StockMovement> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return stockMovementRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }
}
