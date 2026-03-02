package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ItemBarcode;
import com.blinc.xpos.modules.catalog.repository.ItemBarcodeRepository;
import com.blinc.xpos.modules.catalog.service.ItemBarcodeService;
import com.blinc.xpos.modules.catalog.service.ItemService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemBarcodeServiceImpl implements ItemBarcodeService {

  private final ItemBarcodeRepository itemBarcodeRepository;
  private final ItemService itemService;
  private final Clock clock;

  public ItemBarcodeServiceImpl(
      ItemBarcodeRepository itemBarcodeRepository, ItemService itemService, Clock clock) {
    this.itemBarcodeRepository =
        Objects.requireNonNull(itemBarcodeRepository, "itemBarcodeRepository");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ItemBarcode add(UUID orgId, UUID itemId, String barcode) {
    Item item = itemService.require(orgId, itemId);
    ItemBarcode entity = new ItemBarcode();
    entity.setOrg(item.getOrg());
    entity.setItem(item);
    entity.setBarcode(barcode);
    entity.setCreatedAt(Instant.now(clock));
    return itemBarcodeRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public ItemBarcode requireInItem(UUID orgId, UUID itemId, UUID barcodeId) {
    ItemBarcode barcode =
        itemBarcodeRepository
            .findByIdAndOrgId(barcodeId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "ITEM_BARCODE_NOT_FOUND", "Item barcode not found"));
    if (!barcode.getItem().getId().equals(itemId)) {
      throw new NotFoundException(
          "ITEM_BARCODE_NOT_FOUND", "Item barcode not found for this item");
    }
    return barcode;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ItemBarcode> listByItem(UUID orgId, UUID itemId) {
    itemService.require(orgId, itemId);
    return itemBarcodeRepository.findAllByItemIdAndOrgId(itemId, orgId);
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID itemId, UUID barcodeId) {
    ItemBarcode barcode = requireInItem(orgId, itemId, barcodeId);
    itemBarcodeRepository.delete(barcode);
  }
}
