package com.blinc.xpos.api.v1.admin.catalog.dto;

import com.blinc.xpos.common.constants.enums.ItemType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record ItemCreateRequest(
    String sku,
    @NotBlank(message = "Name is required") String name,
    @NotNull(message = "Item type is required") ItemType itemType,
    UUID categoryId,
    UUID baseUomId,
    UUID taxProfileId,
    boolean trackInventory,
    boolean active,
    BigDecimal buyingPrice,
    BigDecimal defaultSellingPrice,
    UUID defaultPriceListId,
    String imageUrl) {}
