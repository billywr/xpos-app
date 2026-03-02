package com.blinc.xpos.api.v1.admin.pricing;

import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListItemCreateRequest;
import com.blinc.xpos.api.v1.admin.pricing.dto.PriceListItemResponse;
import com.blinc.xpos.modules.pricing.domain.PriceListItem;
import com.blinc.xpos.modules.pricing.service.PriceListItemService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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

  public PriceListItemAdminController(PriceListItemService priceListItemService) {
    this.priceListItemService =
        Objects.requireNonNull(priceListItemService, "priceListItemService");
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
  public List<PriceListItemResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID priceListId) {
    return priceListItemService.listByPriceList(orgId, priceListId).stream()
        .map(this::toResponse)
        .toList();
  }

  @GetMapping("/{priceListItemId}")
  public PriceListItemResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID priceListId,
      @PathVariable UUID priceListItemId) {
    return toResponse(
        priceListItemService.requireInPriceList(orgId, priceListId, priceListItemId));
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
        line.getPrice(),
        line.getCurrency(),
        line.getCreatedAt());
  }
}
