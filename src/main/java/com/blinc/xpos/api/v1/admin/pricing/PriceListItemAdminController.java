package com.blinc.xpos.api.v1.admin.pricing;

import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListItemCreateRequest;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListItemResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListItemUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import com.blinc.xpos.modules.pricing.service.PriceListItemService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/price-lists/{priceListId}/items")
public class PriceListItemAdminController {

  private final PriceListItemService priceListItemService;
  private final PageRequestFactory pageRequestFactory;

  public PriceListItemAdminController(
      PriceListItemService priceListItemService,
      PageRequestFactory pageRequestFactory) {
    this.priceListItemService =
        Objects.requireNonNull(priceListItemService, "priceListItemService");
    this.pageRequestFactory =
        Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PriceListItemResponse add(
      @PathVariable UUID orgId,
      @PathVariable UUID priceListId,
      @Valid @RequestBody PriceListItemCreateRequest request) {
    PriceListItem line =
        priceListItemService.add(
            orgId,
            priceListId,
            request.itemId(),
            request.price(),
            request.currency());
    return toResponse(line);
  }

  @GetMapping
  public Page<PriceListItemResponse> list(
      @PathVariable UUID orgId,
      @PathVariable UUID priceListId,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(
            pageable,
            Sort.by("item.name").and(Sort.by("createdAt")));
    return priceListItemService
        .listByPriceList(orgId, priceListId, normalized)
        .map(this::toResponse);
  }

  @GetMapping("/{priceListItemId}")
  public PriceListItemResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID priceListId,
      @PathVariable UUID priceListItemId) {
    return toResponse(
        priceListItemService.requireInPriceList(orgId, priceListId, priceListItemId));
  }

  @PatchMapping("/{priceListItemId}")
  public PriceListItemResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID priceListId,
      @PathVariable UUID priceListItemId,
      @Valid @RequestBody PriceListItemUpdateRequest request) {
    PriceListItem line =
        priceListItemService.update(
            orgId,
            priceListId,
            priceListItemId,
            request.price(),
            request.currency());
    return toResponse(line);
  }

  @DeleteMapping("/{priceListItemId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(
      @PathVariable UUID orgId,
      @PathVariable UUID priceListId,
      @PathVariable UUID priceListItemId) {
    priceListItemService.remove(orgId, priceListId, priceListItemId);
  }

  private PriceListItemResponse toResponse(PriceListItem line) {
    return new PriceListItemResponse(
        line.getId(),
        line.getPriceList().getId(),
        line.getItem().getId(),
        line.getItem().getName(),
        line.getPrice(),
        line.getCurrency(),
        line.getCreatedAt());
  }
}
