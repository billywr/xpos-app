package com.blinc.xpos.api.v1.admin.catalog.dto;

import com.blinc.xpos.common.constants.enums.ItemType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ItemResponse(
    UUID id,
    UUID orgId,
    String sku,
    String name,
    ItemType itemType,
    UUID categoryId,
    UUID baseUomId,
    UUID taxProfileId,
    boolean trackInventory,
    boolean active,
    BigDecimal buyingPrice,
    BigDecimal defaultSellingPrice,
    String primaryImageUrl,
    boolean hasPurchaseHistory,
    Instant createdAt,
    Instant updatedAt,
    String barcode) {}
