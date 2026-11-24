package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemModifierGroupLinkResponse;
import com.blinc.xpos.modules.catalog.domain.ItemModifierGroup;
import com.blinc.xpos.modules.catalog.service.ItemModifierGroupLinkService;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/item-modifier-groups")
public class OrgItemModifierGroupAdminController {

  private final ItemModifierGroupLinkService itemModifierGroupLinkService;

  public OrgItemModifierGroupAdminController(
      ItemModifierGroupLinkService itemModifierGroupLinkService) {
    this.itemModifierGroupLinkService =
        Objects.requireNonNull(itemModifierGroupLinkService, "itemModifierGroupLinkService");
  }

  @GetMapping
  public List<ItemModifierGroupLinkResponse> listAll(@PathVariable UUID orgId) {
    return itemModifierGroupLinkService.listByOrg(orgId).stream().map(this::toResponse).toList();
  }

  private ItemModifierGroupLinkResponse toResponse(ItemModifierGroup link) {
    return new ItemModifierGroupLinkResponse(
        link.getId(), link.getItem().getId(), link.getModifierGroup().getId(), link.getCreatedAt());
  }
}
