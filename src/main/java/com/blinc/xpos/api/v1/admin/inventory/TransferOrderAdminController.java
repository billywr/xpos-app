package com.blinc.xpos.api.v1.admin.inventory;

import com.blinc.xpos.api.v1.admin.inventory.dto.TransferOrderCreateRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.TransferOrderLineAddRequest;
import com.blinc.xpos.api.v1.admin.inventory.dto.TransferOrderLineResponse;
import com.blinc.xpos.api.v1.admin.inventory.dto.TransferOrderResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.inventory.domain.TransferOrder;
import com.blinc.xpos.modules.inventory.domain.TransferOrderLine;
import com.blinc.xpos.modules.inventory.repository.TransferOrderLineRepository;
import com.blinc.xpos.modules.inventory.service.TransferOrderService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/transfer-orders")
public class TransferOrderAdminController {

  private final TransferOrderService transferOrderService;
  private final TransferOrderLineRepository transferOrderLineRepository;
  private final PageRequestFactory pageRequestFactory;

  public TransferOrderAdminController(
      TransferOrderService transferOrderService,
      TransferOrderLineRepository transferOrderLineRepository,
      PageRequestFactory pageRequestFactory) {
    this.transferOrderService =
        Objects.requireNonNull(transferOrderService, "transferOrderService");
    this.transferOrderLineRepository =
        Objects.requireNonNull(transferOrderLineRepository, "transferOrderLineRepository");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TransferOrderResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody TransferOrderCreateRequest request) {
    TransferOrder order =
        transferOrderService.create(orgId, request.fromBranchId(), request.toBranchId());
    return toResponse(order);
  }

  @GetMapping
  public Page<TransferOrderResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return transferOrderService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{transferOrderId}")
  public TransferOrderResponse get(
      @PathVariable UUID orgId, @PathVariable UUID transferOrderId) {
    return toResponse(transferOrderService.require(orgId, transferOrderId));
  }

  @PostMapping("/{transferOrderId}/lines")
  public TransferOrderResponse addLine(
      @PathVariable UUID orgId,
      @PathVariable UUID transferOrderId,
      @Valid @RequestBody TransferOrderLineAddRequest request) {
    TransferOrder order =
        transferOrderService.addLine(
            orgId, transferOrderId, request.itemId(), request.qty(), request.uomId());
    return toResponse(order);
  }

  private TransferOrderResponse toResponse(TransferOrder o) {
    List<TransferOrderLine> lines =
        transferOrderLineRepository.findByTransferOrderIdOrderByCreatedAt(o.getId());
    List<TransferOrderLineResponse> lineResponses =
        lines.stream().map(this::toLineResponse).toList();
    return new TransferOrderResponse(
        o.getId(), o.getOrg().getId(), o.getFromBranch().getId(), o.getToBranch().getId(),
        o.getStatus(), o.getCreatedAt(), o.getUpdatedAt(), lineResponses);
  }

  private TransferOrderLineResponse toLineResponse(TransferOrderLine l) {
    return new TransferOrderLineResponse(
        l.getId(), l.getTransferOrder().getId(), l.getItem().getId(), l.getItem().getName(),
        l.getQty(), l.getUom() != null ? l.getUom().getId() : null, l.getCreatedAt());
  }
}
