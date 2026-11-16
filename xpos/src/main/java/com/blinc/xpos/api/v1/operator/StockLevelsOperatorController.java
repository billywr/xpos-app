package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.StockLevelResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.inventory.service.InventoryItemService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StockLevelsOperatorController {

  private final InventoryItemService inventoryItemService;
  private final StaffAuthorizationService staffAuthorizationService;
  private final CurrentPrincipalResolver principalResolver;

  public StockLevelsOperatorController(
      InventoryItemService inventoryItemService,
      StaffAuthorizationService staffAuthorizationService,
      CurrentPrincipalResolver principalResolver) {
    this.inventoryItemService =
        Objects.requireNonNull(inventoryItemService, "inventoryItemService");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
  }

  @GetMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/stock-levels")
  public ResponseEntity<List<StockLevelResponse>> getStockLevels(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestParam(name = "itemIds") List<UUID> itemIds) {
    staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    Set<UUID> ids = itemIds == null ? Set.of() : Set.copyOf(itemIds);
    if (ids.isEmpty()) {
      return ResponseEntity.ok(List.of());
    }
    var levels = inventoryItemService.getOnHandQtysByItemIds(orgId, branchId, ids);
    List<StockLevelResponse> result =
        ids.stream()
            .map(id -> new StockLevelResponse(id, levels.getOrDefault(id, BigDecimal.ZERO)))
            .toList();
    return ResponseEntity.ok(result);
  }
}
