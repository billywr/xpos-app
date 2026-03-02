package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ItemImage;
import com.blinc.xpos.modules.catalog.repository.ItemImageRepository;
import com.blinc.xpos.modules.catalog.service.ItemImageService;
import com.blinc.xpos.modules.catalog.service.ItemService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemImageServiceImpl implements ItemImageService {

  private final ItemImageRepository itemImageRepository;
  private final ItemService itemService;
  private final Clock clock;

  public ItemImageServiceImpl(
      ItemImageRepository itemImageRepository, ItemService itemService, Clock clock) {
    this.itemImageRepository =
        Objects.requireNonNull(itemImageRepository, "itemImageRepository");
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public ItemImage add(UUID orgId, UUID itemId, String url, int sortOrder, boolean isPrimary) {
    Item item = itemService.require(orgId, itemId);
    if (isPrimary) {
      List<ItemImage> existing =
          itemImageRepository.findAllByItemIdAndOrgId(itemId, orgId);
      for (ItemImage img : existing) {
        if (Boolean.TRUE.equals(img.getIsPrimary())) {
          img.setIsPrimary(false);
          itemImageRepository.save(img);
        }
      }
    }
    ItemImage entity = new ItemImage();
    entity.setOrg(item.getOrg());
    entity.setItem(item);
    entity.setUrl(url);
    entity.setSortOrder(sortOrder);
    entity.setIsPrimary(isPrimary);
    entity.setCreatedAt(Instant.now(clock));
    return itemImageRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public ItemImage requireInItem(UUID orgId, UUID itemId, UUID imageId) {
    ItemImage image =
        itemImageRepository
            .findByIdAndOrgId(imageId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "ITEM_IMAGE_NOT_FOUND", "Item image not found"));
    if (!image.getItem().getId().equals(itemId)) {
      throw new NotFoundException(
          "ITEM_IMAGE_NOT_FOUND", "Item image not found for this item");
    }
    return image;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ItemImage> listByItem(UUID orgId, UUID itemId) {
    itemService.require(orgId, itemId);
    return itemImageRepository.findAllByItemIdAndOrgId(itemId, orgId);
  }

  @Override
  @Transactional(readOnly = true)
  public Map<UUID, String> findPrimaryUrlsByItemIds(UUID orgId, List<UUID> itemIds) {
    if (itemIds == null || itemIds.isEmpty()) {
      return Map.of();
    }
    return itemImageRepository
        .findPrimaryByOrgIdAndItemIdIn(orgId, itemIds)
        .stream()
        .collect(
            Collectors.toMap(
                img -> img.getItem().getId(),
                ItemImage::getUrl,
                (a, b) -> a));
  }

  @Override
  @Transactional
  public void remove(UUID orgId, UUID itemId, UUID imageId) {
    ItemImage image = requireInItem(orgId, itemId, imageId);
    itemImageRepository.delete(image);
  }
}
