package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.ItemBarcode;
import java.util.List;
import java.util.UUID;

public interface ItemBarcodeService {

  ItemBarcode add(UUID orgId, UUID itemId, String barcode);

  ItemBarcode requireInItem(UUID orgId, UUID itemId, UUID barcodeId);

  List<ItemBarcode> listByItem(UUID orgId, UUID itemId);

  void remove(UUID orgId, UUID itemId, UUID barcodeId);
}
