package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemIdsWithPricesResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemUpdateRequest;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ItemImage;
import com.blinc.xpos.modules.catalog.service.ItemBarcodeService;
import com.blinc.xpos.modules.catalog.service.ItemImageService;
import com.blinc.xpos.modules.catalog.service.ItemService;
import com.blinc.xpos.modules.inventory.repository.StockMovementRepository;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/items")
public class ItemAdminController {

  private final ItemService itemService;
  private final ItemBarcodeService itemBarcodeService;
  private final ItemImageService itemImageService;
  private final PageRequestFactory pageRequestFactory;
  private final StockMovementRepository stockMovementRepository;

  public ItemAdminController(
      ItemService itemService,
      ItemBarcodeService itemBarcodeService,
      ItemImageService itemImageService,
      PageRequestFactory pageRequestFactory,
      StockMovementRepository stockMovementRepository) {
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.itemBarcodeService = Objects.requireNonNull(itemBarcodeService, "itemBarcodeService");
    this.itemImageService = Objects.requireNonNull(itemImageService, "itemImageService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.stockMovementRepository =
        Objects.requireNonNull(stockMovementRepository, "stockMovementRepository");
  }

  @GetMapping("/ids-with-prices")
  public ItemIdsWithPricesResponse itemIdsWithPrices(@PathVariable UUID orgId) {
    List<UUID> ids = itemService.findItemIdsWithSellingPrice(orgId);
    return new ItemIdsWithPricesResponse(ids);
  }

  @GetMapping("/by-barcode")
  public ItemResponse getByBarcode(@PathVariable UUID orgId, @RequestParam String barcode) {
    Item item =
        itemBarcodeService
            .findItemByBarcode(orgId, barcode)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "ITEM_NOT_FOUND_BY_BARCODE", "No item found for barcode: " + barcode));
    String primaryImageUrl = resolvePrimaryImageUrl(orgId, item.getId());
    boolean hasHistory =
        stockMovementRepository.findMaxUnitCostByOrgAndItem(orgId, item.getId()) != null;
    return toResponse(item, primaryImageUrl, hasHistory, resolveFirstBarcode(orgId, item.getId()));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ItemResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody ItemCreateRequest request) {
    Item item =
        itemService.create(
            orgId,
            request.sku(),
            request.name(),
            request.itemType(),
            request.categoryId(),
            request.baseUomId(),
            request.taxProfileId(),
            request.trackInventory(),
            request.active(),
            request.buyingPrice(),
            request.defaultSellingPrice(),
            request.visibleInPos());
    if (request.imageUrl() != null && !request.imageUrl().isBlank()) {
      itemImageService.add(orgId, item.getId(), request.imageUrl().trim(), 0, true);
    }
    String primaryImageUrl = resolvePrimaryImageUrl(orgId, item.getId());
    return toResponse(item, primaryImageUrl, false, null);
  }

  @GetMapping
  public Page<ItemResponse> list(
      @PathVariable UUID orgId,
      @RequestParam(required = false) UUID categoryId,
      Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    var page = itemService.list(orgId, categoryId, normalized);
    List<UUID> itemIds = page.getContent().stream().map(Item::getId).toList();
    var primaryUrls = itemImageService.findPrimaryUrlsByItemIds(orgId, itemIds);
    var idsWithHistory =
        new java.util.HashSet<>(
            stockMovementRepository.findItemIdsWithPurchaseHistoryByOrgId(orgId));
    Map<UUID, String> itemIdToBarcode = itemBarcodeService.getFirstBarcodeByItemIds(orgId, itemIds);
    return page.map(
        item ->
            toResponse(
                item,
                primaryUrls.get(item.getId()),
                idsWithHistory.contains(item.getId()),
                itemIdToBarcode.get(item.getId())));
  }

  @GetMapping("/{itemId}")
  public ItemResponse get(@PathVariable UUID orgId, @PathVariable UUID itemId) {
    Item item = itemService.require(orgId, itemId);
    String primaryImageUrl = resolvePrimaryImageUrl(orgId, itemId);
    boolean hasHistory = stockMovementRepository.findMaxUnitCostByOrgAndItem(orgId, itemId) != null;
    return toResponse(item, primaryImageUrl, hasHistory, resolveFirstBarcode(orgId, itemId));
  }

  @PatchMapping("/{itemId}")
  public ItemResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @Valid @RequestBody ItemUpdateRequest request) {
    Item updated =
        itemService.update(
            orgId,
            itemId,
            request.sku(),
            request.name(),
            request.itemType(),
            request.categoryId(),
            request.baseUomId(),
            request.taxProfileId(),
            request.trackInventory(),
            request.active(),
            request.buyingPrice(),
            request.defaultSellingPrice(),
            request.visibleInPos());
    if (request.imageUrl() != null && !request.imageUrl().isBlank()) {
      for (ItemImage existing : itemImageService.listByItem(orgId, itemId)) {
        itemImageService.remove(orgId, itemId, existing.getId());
      }
      itemImageService.add(orgId, itemId, request.imageUrl().trim(), 0, true);
    }
    String primaryImageUrl = resolvePrimaryImageUrl(orgId, itemId);
    boolean hasHistory = stockMovementRepository.findMaxUnitCostByOrgAndItem(orgId, itemId) != null;
    return toResponse(updated, primaryImageUrl, hasHistory, resolveFirstBarcode(orgId, itemId));
  }

  @DeleteMapping("/{itemId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID itemId) {
    itemService.delete(orgId, itemId);
  }

  private String resolvePrimaryImageUrl(UUID orgId, UUID itemId) {
    return itemImageService.listByItem(orgId, itemId).stream()
        .filter(img -> Boolean.TRUE.equals(img.getIsPrimary()))
        .findFirst()
        .map(ItemImage::getUrl)
        .orElse(null);
  }

  private String resolveFirstBarcode(UUID orgId, UUID itemId) {
    var list = itemBarcodeService.listByItem(orgId, itemId);
    return list.isEmpty() ? null : list.get(0).getBarcode();
  }

  private ItemResponse toResponse(
      Item item, String primaryImageUrl, boolean hasPurchaseHistory, String barcode) {
    return new ItemResponse(
        item.getId(),
        item.getOrg().getId(),
        item.getSku(),
        item.getName(),
        item.getItemType(),
        item.getCategory() != null ? item.getCategory().getId() : null,
        item.getBaseUom() != null ? item.getBaseUom().getId() : null,
        item.getTaxProfile() != null ? item.getTaxProfile().getId() : null,
        item.getTrackInventory(),
        item.getActive(),
        item.isVisibleInPos(),
        item.getBuyingPrice(),
        item.getDefaultSellingPrice(),
        primaryImageUrl,
        hasPurchaseHistory,
        item.getCreatedAt(),
        item.getUpdatedAt(),
        barcode);
  }
}
