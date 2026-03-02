package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.InventoryReportLineResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.service.InventoryReportService;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/inventory-report")
public class InventoryReportAdminController {

  private final InventoryReportService inventoryReportService;
  private final BranchService branchService;
  private final PageRequestFactory pageRequestFactory;

  public InventoryReportAdminController(
      InventoryReportService inventoryReportService,
      BranchService branchService,
      PageRequestFactory pageRequestFactory) {
    this.inventoryReportService =
        Objects.requireNonNull(inventoryReportService, "inventoryReportService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.pageRequestFactory =
        Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @GetMapping
  public Page<InventoryReportLineResponse> listByBranch(
      @PathVariable UUID orgId,
      @RequestParam UUID branchId,
      Pageable pageable) {
    branchService.require(orgId, branchId);
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("item.name").ascending());
    return inventoryReportService.listByBranch(orgId, branchId, normalized);
  }
}
