package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ModifierOption;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.catalog.repository.ModifierOptionRepository;
import com.blinc.xpos.modules.catalog.service.ModifierGroupService;
import com.blinc.xpos.modules.catalog.service.ModifierOptionService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ModifierOptionServiceImpl implements ModifierOptionService {

  private final ModifierOptionRepository modifierOptionRepository;
  private final ModifierGroupService modifierGroupService;
  private final ItemRepository itemRepository;
  private final Clock clock;

  public ModifierOptionServiceImpl(
      ModifierOptionRepository modifierOptionRepository,
      ModifierGroupService modifierGroupService,
      ItemRepository itemRepository,
      Clock clock) {
    this.modifierOptionRepository =
        Objects.requireNonNull(modifierOptionRepository, "modifierOptionRepository");
    this.modifierGroupService =
        Objects.requireNonNull(modifierGroupService, "modifierGroupService");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ModifierOption create(
      UUID orgId, UUID modifierGroupId, String name, BigDecimal priceDelta, UUID itemId) {
    var group = modifierGroupService.require(orgId, modifierGroupId);
    ModifierOption option = new ModifierOption();
    option.setOrg(group.getOrg());
    option.setModifierGroup(group);
    option.setName(name);
    option.setPriceDelta(priceDelta != null ? priceDelta : BigDecimal.ZERO);
    if (itemId != null) {
      Item item =
          itemRepository
              .findByIdAndOrgId(itemId, orgId)
              .orElseThrow(() -> new NotFoundException("ITEM_NOT_FOUND", "Item not found"));
      option.setItem(item);
    } else {
      option.setItem(null);
    }
    option.setCreatedAt(Instant.now(clock));
    return modifierOptionRepository.save(option);
  }

  @Override
  @Transactional(readOnly = true)
  public ModifierOption require(UUID orgId, UUID modifierOptionId) {
    return modifierOptionRepository
        .findByIdAndOrgId(modifierOptionId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "MODIFIER_OPTION_NOT_FOUND", "Modifier option not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public ModifierOption requireInGroup(UUID orgId, UUID modifierGroupId, UUID modifierOptionId) {
    ModifierOption option = require(orgId, modifierOptionId);
    if (!option.getModifierGroup().getId().equals(modifierGroupId)) {
      throw new NotFoundException(
          "MODIFIER_OPTION_NOT_FOUND", "Modifier option not found in this group");
    }
    return option;
  }

  @Override
  @Transactional(readOnly = true)
  public Page<ModifierOption> listByGroup(
      UUID orgId, UUID modifierGroupId, Pageable pageable) {
    modifierGroupService.require(orgId, modifierGroupId);
    return modifierOptionRepository.findAllByModifierGroupIdAndOrgId(
        modifierGroupId, orgId, pageable);
  }

  @Override
  @Transactional
  public ModifierOption update(
      UUID orgId, UUID modifierOptionId, String name, BigDecimal priceDelta, UUID itemId) {
    ModifierOption option = require(orgId, modifierOptionId);
    option.setName(name);
    option.setPriceDelta(priceDelta != null ? priceDelta : BigDecimal.ZERO);
    if (itemId != null) {
      Item item =
          itemRepository
              .findByIdAndOrgId(itemId, orgId)
              .orElseThrow(() -> new NotFoundException("ITEM_NOT_FOUND", "Item not found"));
      option.setItem(item);
    } else {
      option.setItem(null);
    }
    return modifierOptionRepository.save(option);
  }
}
