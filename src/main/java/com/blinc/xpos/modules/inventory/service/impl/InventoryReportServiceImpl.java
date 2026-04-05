package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.api.v1.admin.inventory.dto.InventoryReportLineResponse;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import com.blinc.xpos.modules.inventory.service.InventoryReportService;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryReportServiceImpl implements InventoryReportService {

  private final InventoryItemRepository inventoryItemRepository;
  private final StockMovementRepository stockMovementRepository;

  public InventoryReportServiceImpl(
      InventoryItemRepository inventoryItemRepository,
      StockMovementRepository stockMovementRepository) {
    this.inventoryItemRepository =
        Objects.requireNonNull(inventoryItemRepository, "inventoryItemRepository");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
  }

  @Override
  @Transactional(readOnly = true)
  public Page<InventoryReportLineResponse> listByBranch(
      UUID orgId, UUID branchId, Pageable pageable) {
    Objects.requireNonNull(orgId, "orgId");
    Objects.requireNonNull(branchId, "branchId");

    Map<UUID, BigDecimal> soldByItemId = loadSoldQtys(orgId, branchId);
    Map<UUID, BigDecimal> receivedByItemId = loadReceivedQtys(orgId, branchId);

    return inventoryItemRepository
        .findAllByOrgIdAndBranchIdWithItem(orgId, branchId, pageable)
        .map(
            inv -> {
              UUID itemId = inv.getItem().getId();
              BigDecimal sold = soldByItemId.getOrDefault(itemId, BigDecimal.ZERO);
              BigDecimal received = receivedByItemId.getOrDefault(itemId, BigDecimal.ZERO);
              return new InventoryReportLineResponse(
                  itemId,
                  inv.getItem().getName(),
                  inv.getItem().getSku(),
                  inv.getOnHandQty(),
                  sold,
                  inv.getReservedQty(),
                  received,
                  inv.getItem().getTrackInventory());
            });
  }

  private Map<UUID, BigDecimal> loadReceivedQtys(UUID orgId, UUID branchId) {
    Map<UUID, BigDecimal> result = new HashMap<>();
    for (Object[] row : stockMovementRepository.sumReceivedQtyByItemIdForBranch(orgId, branchId)) {
      UUID itemId = (UUID) row[0];
      BigDecimal sum = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
      result.put(itemId, sum);
    }
    return result;
  }

  private Map<UUID, BigDecimal> loadSoldQtys(UUID orgId, UUID branchId) {
    Map<UUID, BigDecimal> result = new HashMap<>();
    for (Object[] row : stockMovementRepository.sumSoldQtyByItemIdForBranch(orgId, branchId)) {
      UUID itemId = (UUID) row[0];
      BigDecimal sum = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
      result.put(itemId, sum);
    }
    return result;
  }
}
