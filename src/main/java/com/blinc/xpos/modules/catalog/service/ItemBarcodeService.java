package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ItemBarcode;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface ItemBarcodeService {

  ItemBarcode add(UUID orgId, UUID itemId, String barcode);

  ItemBarcode requireInItem(UUID orgId, UUID itemId, UUID barcodeId);

  List<ItemBarcode> listByItem(UUID orgId, UUID itemId);

  void remove(UUID orgId, UUID itemId, UUID barcodeId);

  /** Find item by barcode in this org. Returns empty if no barcode matches. */
  Optional<Item> findItemByBarcode(UUID orgId, String barcode);

  /** First barcode per item (by createdAt). Keys are item ids. */
  Map<UUID, String> getFirstBarcodeByItemIds(UUID orgId, List<UUID> itemIds);
}
