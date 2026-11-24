package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ItemModifierGroup;
import com.blinc.xpos.modules.catalog.domain.ModifierGroup;
import com.blinc.xpos.modules.catalog.repository.ItemModifierGroupRepository;
import com.blinc.xpos.modules.catalog.service.ItemModifierGroupLinkService;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.ModifierGroupService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemModifierGroupLinkServiceImpl implements ItemModifierGroupLinkService {

  private final ItemModifierGroupRepository itemModifierGroupRepository;
  private final ItemService itemService;
  private final ModifierGroupService modifierGroupService;
  private final Clock clock;

  public ItemModifierGroupLinkServiceImpl(
      ItemModifierGroupRepository itemModifierGroupRepository,
      ItemService itemService,
      ModifierGroupService modifierGroupService,
      Clock clock) {
    this.itemModifierGroupRepository =
        Objects.requireNonNull(itemModifierGroupRepository, "itemModifierGroupRepository");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.modifierGroupService =
        Objects.requireNonNull(modifierGroupService, "modifierGroupService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ItemModifierGroup add(UUID orgId, UUID itemId, UUID modifierGroupId) {
    Item item = itemService.require(orgId, itemId);
    ModifierGroup group = modifierGroupService.require(orgId, modifierGroupId);
    ItemModifierGroup link = new ItemModifierGroup();
    link.setOrg(item.getOrg());
    link.setItem(item);
    link.setModifierGroup(group);
    link.setCreatedAt(Instant.now(clock));
    return itemModifierGroupRepository.save(link);
  }

  @Override
  @Transactional(readOnly = true)
  public ItemModifierGroup requireInItem(UUID orgId, UUID itemId, UUID itemModifierGroupId) {
    ItemModifierGroup link =
        itemModifierGroupRepository
            .findByIdAndOrgId(itemModifierGroupId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "ITEM_MODIFIER_GROUP_NOT_FOUND", "Item modifier group link not found"));
    if (!link.getItem().getId().equals(itemId)) {
      throw new NotFoundException(
          "ITEM_MODIFIER_GROUP_NOT_FOUND", "Item modifier group link not found for this item");
    }
    return link;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ItemModifierGroup> listByItem(UUID orgId, UUID itemId) {
    itemService.require(orgId, itemId);
    return itemModifierGroupRepository.findAllByItemIdAndOrgId(itemId, orgId);
  }

  @Override
  @Transactional(readOnly = true)
  public List<ItemModifierGroup> listByOrg(UUID orgId) {
    return itemModifierGroupRepository.findAllByOrgId(orgId);
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID itemId, UUID itemModifierGroupId) {
    ItemModifierGroup link = requireInItem(orgId, itemId, itemModifierGroupId);
    itemModifierGroupRepository.delete(link);
  }
}
