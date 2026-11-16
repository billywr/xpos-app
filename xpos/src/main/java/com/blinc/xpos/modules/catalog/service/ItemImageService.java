package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.ItemImage;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface ItemImageService {

  ItemImage add(UUID orgId, UUID itemId, String url, int sortOrder, boolean isPrimary);

  ItemImage requireInItem(UUID orgId, UUID itemId, UUID imageId);

  List<ItemImage> listByItem(UUID orgId, UUID itemId);

  Map<UUID, String> findPrimaryUrlsByItemIds(UUID orgId, List<UUID> itemIds);

  void remove(UUID orgId, UUID itemId, UUID imageId);
}
