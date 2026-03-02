package com.blinc.xpos.api.v1.admin.pricing;

import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListCreateRequest;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.pricing.domain.PriceList;
import com.blinc.xpos.modules.pricing.service.PriceListService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/price-lists")
public class PriceListAdminController {

  private final PriceListService priceListService;
  private final PageRequestFactory pageRequestFactory;

  public PriceListAdminController(
      PriceListService priceListService, PageRequestFactory pageRequestFactory) {
    this.priceListService = Objects.requireNonNull(priceListService, "priceListService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PriceListResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody PriceListCreateRequest request) {
    PriceList list =
        priceListService.create(
            orgId,
            request.branchId(),
            request.channel(),
            request.name(),
            request.priority(),
            request.active());
    return toResponse(list);
  }

  @GetMapping
  public Page<PriceListResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("priority").ascending());
    return priceListService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{priceListId}")
  public PriceListResponse get(
      @PathVariable UUID orgId, @PathVariable UUID priceListId) {
    return toResponse(priceListService.require(orgId, priceListId));
  }

  @PatchMapping("/{priceListId}")
  public PriceListResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID priceListId,
      @Valid @RequestBody PriceListUpdateRequest request) {
    PriceList updated =
        priceListService.update(
            orgId,
            priceListId,
            request.branchId(),
            request.channel(),
            request.name(),
            request.priority(),
            request.active());
    return toResponse(updated);
  }

  @DeleteMapping("/{priceListId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID priceListId) {
    priceListService.delete(orgId, priceListId);
  }

  private PriceListResponse toResponse(PriceList list) {
    return new PriceListResponse(
        list.getId(),
        list.getOrg().getId(),
        list.getBranch() != null ? list.getBranch().getId() : null,
        list.getChannel(),
        list.getName(),
        list.getPriority(),
        list.getActive(),
        list.getCreatedAt(),
        list.getUpdatedAt());
  }
}
