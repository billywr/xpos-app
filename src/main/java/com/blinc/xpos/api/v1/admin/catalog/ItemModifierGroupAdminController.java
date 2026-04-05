package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemModifierGroupLinkCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemModifierGroupLinkResponse;
import com.blinc.xpos.modules.catalog.domain.ItemModifierGroup;
import com.blinc.xpos.modules.catalog.service.ItemModifierGroupLinkService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/items/{itemId}/modifier-groups")
public class ItemModifierGroupAdminController {

  private final ItemModifierGroupLinkService itemModifierGroupLinkService;

  public ItemModifierGroupAdminController(
      ItemModifierGroupLinkService itemModifierGroupLinkService) {
    this.itemModifierGroupLinkService =
        Objects.requireNonNull(itemModifierGroupLinkService, "itemModifierGroupLinkService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ItemModifierGroupLinkResponse add(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @Valid @RequestBody ItemModifierGroupLinkCreateRequest request) {
    ItemModifierGroup link =
        itemModifierGroupLinkService.add(orgId, itemId, request.modifierGroupId());
    return toResponse(link);
  }

  @GetMapping
  public List<ItemModifierGroupLinkResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID itemId) {
    return itemModifierGroupLinkService.listByItem(orgId, itemId).stream()
        .map(this::toResponse)
        .toList();
  }

  @GetMapping("/{itemModifierGroupId}")
  public ItemModifierGroupLinkResponse get(
      @PathVariable UUID orgId, @PathVariable UUID itemId, @PathVariable UUID itemModifierGroupId) {
    return toResponse(
        itemModifierGroupLinkService.requireInItem(orgId, itemId, itemModifierGroupId));
  }

  @DeleteMapping("/{itemModifierGroupId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(
      @PathVariable UUID orgId, @PathVariable UUID itemId, @PathVariable UUID itemModifierGroupId) {
    itemModifierGroupLinkService.remove(orgId, itemId, itemModifierGroupId);
  }

  private ItemModifierGroupLinkResponse toResponse(ItemModifierGroup link) {
    return new ItemModifierGroupLinkResponse(
        link.getId(), link.getItem().getId(), link.getModifierGroup().getId(), link.getCreatedAt());
  }
}
