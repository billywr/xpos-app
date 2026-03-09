package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.GrnCreateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.GrnLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.GrnUpdateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.GoodsReceiptNoteResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.catalog.service.ItemBarcodeService;
import com.blinc.xpos.modules.inventory.domain.GoodsReceiptNote;
import com.blinc.xpos.modules.inventory.domain.GrnLine;
import com.blinc.xpos.modules.inventory.repository.GrnLineRepository;
import com.blinc.xpos.modules.inventory.service.GoodsReceiptNoteService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/goods-receipt-notes")
public class GoodsReceiptNoteAdminController {

  private final GoodsReceiptNoteService grnService;
  private final GrnLineRepository grnLineRepository;
  private final ItemBarcodeService itemBarcodeService;
  private final PageRequestFactory pageRequestFactory;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public GoodsReceiptNoteAdminController(
      GoodsReceiptNoteService grnService,
      GrnLineRepository grnLineRepository,
      ItemBarcodeService itemBarcodeService,
      PageRequestFactory pageRequestFactory,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.grnService = Objects.requireNonNull(grnService, "grnService");
    this.grnLineRepository = Objects.requireNonNull(grnLineRepository, "grnLineRepository");
    this.itemBarcodeService =
        Objects.requireNonNull(itemBarcodeService, "itemBarcodeService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public GoodsReceiptNoteResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody GrnCreateRequest request) {
    var staffUser = staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
    List<GoodsReceiptNoteService.GrnLineRequest> lineReqs =
        request.lines().stream()
            .map(
                l ->
                    new GoodsReceiptNoteService.GrnLineRequest(
                        l.itemId(), l.qty(), l.uomId(), l.receivedUnitCost()))
            .toList();
    GoodsReceiptNote grn =
        grnService.create(
            orgId,
            request.branchId(),
            request.supplierId(),
            request.purchaseOrderId(),
            staffUser.getId(),
            lineReqs);
    return toResponse(grn);
  }

  @GetMapping
  @Transactional(readOnly = true)
  public Page<GoodsReceiptNoteResponse> listByBranch(
      @PathVariable UUID orgId,
      @RequestParam UUID branchId,
      @RequestParam(name = "includeInactive", defaultValue = "false") boolean includeInactive,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("receivedAt").descending());
    return grnService
        .listByBranch(orgId, branchId, includeInactive, normalized)
        .map(this::toResponse);
  }

  @PatchMapping("/{grnId}")
  public GoodsReceiptNoteResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID grnId,
      @Valid @RequestBody GrnUpdateRequest request) {
    var staffUser = staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
    List<GoodsReceiptNoteService.GrnLineRequest> lineReqs = null;
    if (request.lines() != null) {
      lineReqs =
          request.lines().stream()
              .map(
                  l ->
                      new GoodsReceiptNoteService.GrnLineRequest(
                          l.itemId(), l.qty(), l.uomId(), l.receivedUnitCost()))
              .toList();
    }
    GoodsReceiptNote grn =
        grnService.update(
            orgId,
            grnId,
            request.supplierId(),
            request.receivedAt(),
            request.active(),
            lineReqs,
            staffUser.getId());
    return toResponse(grn);
  }

  @GetMapping("/{grnId}")
  @Transactional(readOnly = true)
  public GoodsReceiptNoteResponse get(@PathVariable UUID orgId, @PathVariable UUID grnId) {
    return toResponse(grnService.require(orgId, grnId));
  }

  private GoodsReceiptNoteResponse toResponse(GoodsReceiptNote grn) {
    List<GrnLine> lines = grnLineRepository.findByGrnIdOrderByCreatedAt(grn.getId());
    List<UUID> itemIds = lines.stream().map(l -> l.getItem().getId()).toList();
    Map<UUID, String> itemIdToBarcode =
        itemBarcodeService.getFirstBarcodeByItemIds(grn.getOrg().getId(), itemIds);
    List<GrnLineResponse> lineResponses =
        lines.stream()
            .map(l -> toLineResponse(l, itemIdToBarcode.get(l.getItem().getId())))
            .toList();
    return new GoodsReceiptNoteResponse(
        grn.getId(),
        grn.getOrg().getId(),
        grn.getBranch().getId(),
        grn.getSupplier().getId(),
        grn.getSupplier().getName(),
        grn.getPurchaseOrder() != null ? grn.getPurchaseOrder().getId() : null,
        grn.getReceivedBy().getId(),
        grn.getReceivedAt(),
        grn.getCreatedAt(),
        grn.getActive(),
        lineResponses);
  }

  private GrnLineResponse toLineResponse(GrnLine l, String barcode) {
    return new GrnLineResponse(
        l.getId(),
        l.getGrn().getId(),
        l.getItem().getId(),
        l.getItem().getName(),
        barcode,
        l.getQty(),
        l.getUom() != null ? l.getUom().getId() : null,
        l.getReceivedUnitCost(),
        l.getCreatedAt());
  }
}
