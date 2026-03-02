package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.constants.enums.ItemType;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Category;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.Uom;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.catalog.service.CategoryService;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.UomService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.pricing.domain.TaxProfile;
import com.blinc.xpos.modules.pricing.service.TaxProfileService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemServiceImpl implements ItemService {

  private final ItemRepository itemRepository;
  private final OrgService orgService;
  private final CategoryService categoryService;
  private final UomService uomService;
  private final TaxProfileService taxProfileService;
  private final Clock clock;

  public ItemServiceImpl(
      ItemRepository itemRepository,
      OrgService orgService,
      CategoryService categoryService,
      UomService uomService,
      TaxProfileService taxProfileService,
      Clock clock) {
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.categoryService = Objects.requireNonNull(categoryService, "categoryService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.taxProfileService = Objects.requireNonNull(taxProfileService, "taxProfileService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Item create(
      UUID orgId,
      String sku,
      String name,
      ItemType itemType,
      UUID categoryId,
      UUID baseUomId,
      UUID taxProfileId,
      boolean trackInventory,
      boolean active) {
    var org = orgService.require(orgId);
    Item item = new Item();
    item.setOrg(org);
    item.setSku(sku);
    item.setName(name);
    item.setItemType(itemType);
    if (categoryId != null) {
      Category category = categoryService.require(orgId, categoryId);
      item.setCategory(category);
    } else {
      item.setCategory(null);
    }
    if (baseUomId != null) {
      Uom baseUom = uomService.require(orgId, baseUomId);
      item.setBaseUom(baseUom);
    } else {
      item.setBaseUom(null);
    }
    if (taxProfileId != null) {
      TaxProfile taxProfile = taxProfileService.require(orgId, taxProfileId);
      item.setTaxProfile(taxProfile);
    } else {
      item.setTaxProfile(null);
    }
    item.setTrackInventory(trackInventory);
    item.setActive(active);
    Instant now = Instant.now(clock);
    item.setCreatedAt(now);
    item.setUpdatedAt(now);
    return itemRepository.save(item);
  }

  @Override
  @Transactional(readOnly = true)
  public Item require(UUID orgId, UUID itemId) {
    return itemRepository
        .findByIdAndOrgId(itemId, orgId)
        .orElseThrow(() -> new NotFoundException("ITEM_NOT_FOUND", "Item not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Item> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return itemRepository.findAllByOrgIdAndActiveTrue(orgId, pageable);
  }

  @Override
  @Transactional
  public Item update(
      UUID orgId,
      UUID itemId,
      String sku,
      String name,
      ItemType itemType,
      UUID categoryId,
      UUID baseUomId,
      UUID taxProfileId,
      boolean trackInventory,
      boolean active) {
    Item item = require(orgId, itemId);
    item.setSku(sku);
    item.setName(name);
    item.setItemType(itemType);
    if (categoryId != null) {
      item.setCategory(categoryService.require(orgId, categoryId));
    } else {
      item.setCategory(null);
    }
    if (baseUomId != null) {
      item.setBaseUom(uomService.require(orgId, baseUomId));
    } else {
      item.setBaseUom(null);
    }
    if (taxProfileId != null) {
      item.setTaxProfile(taxProfileService.require(orgId, taxProfileId));
    } else {
      item.setTaxProfile(null);
    }
    item.setTrackInventory(trackInventory);
    item.setActive(active);
    item.setUpdatedAt(Instant.now(clock));
    return itemRepository.save(item);
  }

  @Override
  @Transactional
  public void delete(UUID orgId, UUID itemId) {
    Item item = require(orgId, itemId);
    item.setActive(false);
    item.setUpdatedAt(Instant.now(clock));
    itemRepository.save(item);
  }
}
