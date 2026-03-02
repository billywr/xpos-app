package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.PurchaseOrderCreateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.PurchaseOrderLineAddRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.PurchaseOrderLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.PurchaseOrderResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.PurchaseOrder;
import com.blinc.xpos.modules.inventory.domain.PurchaseOrderLine;
import com.blinc.xpos.modules.inventory.repository.PurchaseOrderLineRepository;
import com.blinc.xpos.modules.inventory.service.PurchaseOrderService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/purchase-orders")
public class PurchaseOrderAdminController {

  private final PurchaseOrderService purchaseOrderService;
  private final PurchaseOrderLineRepository purchaseOrderLineRepository;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public PurchaseOrderAdminController(
      PurchaseOrderService purchaseOrderService,
      PurchaseOrderLineRepository purchaseOrderLineRepository,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.purchaseOrderService =
        Objects.requireNonNull(purchaseOrderService, "purchaseOrderService");
    this.purchaseOrderLineRepository =
        Objects.requireNonNull(purchaseOrderLineRepository, "purchaseOrderLineRepository");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PurchaseOrderResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody PurchaseOrderCreateRequest request) {
    var staffUser = staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
    PurchaseOrder po =
        purchaseOrderService.create(
            orgId,
            request.branchId(),
            request.supplierId(),
            staffUser.getId());
    return toResponse(po);
  }

  @GetMapping
  public Page<PurchaseOrderResponse> listByBranch(
      @PathVariable UUID orgId,
      @org.springframework.web.bind.annotation.RequestParam UUID branchId,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return purchaseOrderService.listByBranch(orgId, branchId, normalized).map(this::toResponse);
  }

  @GetMapping("/{purchaseOrderId}")
  public PurchaseOrderResponse get(
      @PathVariable UUID orgId, @PathVariable UUID purchaseOrderId) {
    return toResponse(purchaseOrderService.require(orgId, purchaseOrderId));
  }

  @PostMapping("/{purchaseOrderId}/lines")
  public PurchaseOrderResponse addLine(
      @PathVariable UUID orgId,
      @PathVariable UUID purchaseOrderId,
      @Valid @RequestBody PurchaseOrderLineAddRequest request) {
    PurchaseOrder po =
        purchaseOrderService.addLine(
            orgId,
            purchaseOrderId,
            request.itemId(),
            request.qty(),
            request.uomId(),
            request.expectedUnitCost());
    return toResponse(po);
  }

  private PurchaseOrderResponse toResponse(PurchaseOrder po) {
    List<PurchaseOrderLine> lines =
        purchaseOrderLineRepository.findByPurchaseOrderIdOrderByCreatedAt(po.getId());
    List<PurchaseOrderLineResponse> lineResponses =
        lines.stream().map(this::toLineResponse).toList();
    return new PurchaseOrderResponse(
        po.getId(),
        po.getOrg().getId(),
        po.getBranch().getId(),
        po.getSupplier().getId(),
        po.getSupplier().getName(),
        po.getStatus(),
        po.getCreatedBy().getId(),
        po.getCreatedAt(),
        po.getUpdatedAt(),
        lineResponses);
  }

  private PurchaseOrderLineResponse toLineResponse(PurchaseOrderLine l) {
    return new PurchaseOrderLineResponse(
        l.getId(),
        l.getPurchaseOrder().getId(),
        l.getItem().getId(),
        l.getItem().getName(),
        l.getQty(),
        l.getUom() != null ? l.getUom().getId() : null,
        l.getExpectedUnitCost(),
        l.getCreatedAt());
  }
}
