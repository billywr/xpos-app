package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ItemUom;
import com.blinc.xpos.modules.catalog.domain.Uom;
import com.blinc.xpos.modules.catalog.repository.ItemUomRepository;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.catalog.service.ItemUomService;
import com.blinc.xpos.modules.catalog.service.UomService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemUomServiceImpl implements ItemUomService {

  private final ItemUomRepository itemUomRepository;
  private final ItemService itemService;
  private final UomService uomService;
  private final Clock clock;

  public ItemUomServiceImpl(
      ItemUomRepository itemUomRepository,
      ItemService itemService,
      UomService uomService,
      Clock clock) {
    this.itemUomRepository = Objects.requireNonNull(itemUomRepository, "itemUomRepository");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ItemUom add(UUID orgId, UUID itemId, UUID uomId, BigDecimal conversionToBase) {
    Item item = itemService.require(orgId, itemId);
    Uom uom = uomService.require(orgId, uomId);
    ItemUom entity = new ItemUom();
    entity.setOrg(item.getOrg());
    entity.setItem(item);
    entity.setUom(uom);
    entity.setConversionToBase(
        conversionToBase != null ? conversionToBase : BigDecimal.ONE);
    entity.setCreatedAt(Instant.now(clock));
    return itemUomRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public ItemUom requireInItem(UUID orgId, UUID itemId, UUID itemUomId) {
    ItemUom itemUom =
        itemUomRepository
            .findByIdAndOrgId(itemUomId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "ITEM_UOM_NOT_FOUND", "Item UoM not found"));
    if (!itemUom.getItem().getId().equals(itemId)) {
      throw new NotFoundException(
          "ITEM_UOM_NOT_FOUND", "Item UoM not found for this item");
    }
    return itemUom;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ItemUom> listByItem(UUID orgId, UUID itemId) {
    itemService.require(orgId, itemId);
    return itemUomRepository.findAllByItemIdAndOrgId(itemId, orgId);
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID itemId, UUID itemUomId) {
    ItemUom itemUom = requireInItem(orgId, itemId, itemUomId);
    itemUomRepository.delete(itemUom);
  }
}
