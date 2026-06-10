package com.blinc.xpos.modules.assistant.service;

import com.blinc.xpos.api.v1.operator.dto.AnalyticsSnapshotResponse;
import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.assistant.InsightType;
import com.blinc.xpos.modules.cash.repository.ShiftRepository;
import com.blinc.xpos.modules.inventory.domain.InventoryItem;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.repository.BranchRepository;
import com.blinc.xpos.modules.reporting.service.OperatorAnalyticsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InsightEvaluationService {

  private static final int LOW_STOCK_LIMIT = 3;

  private final BranchRepository branchRepository;
  private final InventoryItemRepository inventoryItemRepository;
  private final ShiftRepository shiftRepository;
  private final OperatorAnalyticsService analyticsService;
  private final InsightEventService insightEventService;
  private final ObjectMapper objectMapper;

  public InsightEvaluationService(
      BranchRepository branchRepository,
      InventoryItemRepository inventoryItemRepository,
      ShiftRepository shiftRepository,
      OperatorAnalyticsService analyticsService,
      InsightEventService insightEventService,
      ObjectMapper objectMapper) {
    this.branchRepository = Objects.requireNonNull(branchRepository, "branchRepository");
    this.inventoryItemRepository =
        Objects.requireNonNull(inventoryItemRepository, "inventoryItemRepository");
    this.shiftRepository = Objects.requireNonNull(shiftRepository, "shiftRepository");
    this.analyticsService = Objects.requireNonNull(analyticsService, "analyticsService");
    this.insightEventService = Objects.requireNonNull(insightEventService, "insightEventService");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
  }

  @Transactional
  public void evaluateOrg(UUID orgId) {
    List<Branch> branches =
        branchRepository
            .findAllByOrgIdAndStatusIn(orgId, List.of(StatusCommon.ACTIVE), PageRequest.of(0, 200))
            .getContent();
    for (Branch branch : branches) {
      evaluateBranch(orgId, branch.getId());
    }
  }

  @Transactional
  public void evaluateBranch(UUID orgId, UUID branchId) {
    evaluateLowStock(orgId, branchId);
    evaluateOverdueDebt(orgId, branchId);
    evaluateOpenShift(orgId, branchId);
  }

  private void evaluateLowStock(UUID orgId, UUID branchId) {
    List<InventoryItem> items =
        inventoryItemRepository.findLowStockByOrgAndBranch(
            orgId, branchId, PageRequest.of(0, LOW_STOCK_LIMIT));
    if (items.isEmpty()) {
      return;
    }
    ObjectNode data = objectMapper.createObjectNode();
    data.put("count", items.size());
    insightEventService.create(
        orgId,
        branchId,
        InsightType.LOW_STOCK,
        "WARN",
        items.size() + " item(s) at or below reorder point",
        "Review restock list in Inventory or ask the assistant about low stock.",
        data);
  }

  private void evaluateOverdueDebt(UUID orgId, UUID branchId) {
    AnalyticsSnapshotResponse.DebtIntelligence debt =
        analyticsService.getSnapshot(orgId, branchId, null, null).debtIntelligence();
    if (debt.overdueAmount() == null || debt.overdueAmount().compareTo(BigDecimal.ZERO) <= 0) {
      return;
    }
    ObjectNode data = objectMapper.createObjectNode();
    data.put("overdueAmount", debt.overdueAmount());
    data.put("openDebtCount", debt.openDebtCount());
    insightEventService.create(
        orgId,
        branchId,
        InsightType.OVERDUE_DEBT,
        "WARN",
        "Overdue customer debt: " + debt.overdueAmount(),
        "Follow up on overdue balances or ask who owes the most.",
        data);
  }

  private void evaluateOpenShift(UUID orgId, UUID branchId) {
    if (!shiftRepository.existsByBranchIdAndStatus(branchId, ShiftStatus.OPEN)) {
      return;
    }
    ObjectNode data = objectMapper.createObjectNode();
    data.put("hasOpenShift", true);
    insightEventService.create(
        orgId,
        branchId,
        InsightType.OPEN_SHIFT_STALE,
        "INFO",
        "Shift still open",
        "Remember to close shifts before day close.",
        data);
  }
}
