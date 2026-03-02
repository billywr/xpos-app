package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemUomCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemUomResponse;
import com.blinc.xpos.modules.catalog.domain.ItemUom;
import com.blinc.xpos.modules.catalog.service.ItemUomService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/items/{itemId}/uoms")
public class ItemUomAdminController {

  private final ItemUomService itemUomService;

  public ItemUomAdminController(ItemUomService itemUomService) {
    this.itemUomService = Objects.requireNonNull(itemUomService, "itemUomService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ItemUomResponse add(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @Valid @RequestBody ItemUomCreateRequest request) {
    ItemUom itemUom =
        itemUomService.add(
            orgId, itemId, request.uomId(), request.conversionToBase());
    return toResponse(itemUom);
  }

  @GetMapping
  public List<ItemUomResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID itemId) {
    return itemUomService.listByItem(orgId, itemId).stream()
        .map(this::toResponse)
        .toList();
  }

  @GetMapping("/{itemUomId}")
  public ItemUomResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @PathVariable UUID itemUomId) {
    return toResponse(itemUomService.requireInItem(orgId, itemId, itemUomId));
  }

  @DeleteMapping("/{itemUomId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @PathVariable UUID itemUomId) {
    itemUomService.remove(orgId, itemId, itemUomId);
  }

  private ItemUomResponse toResponse(ItemUom itemUom) {
    return new ItemUomResponse(
        itemUom.getId(),
        itemUom.getItem().getId(),
        itemUom.getUom().getId(),
        itemUom.getConversionToBase(),
        itemUom.getCreatedAt());
  }
}
