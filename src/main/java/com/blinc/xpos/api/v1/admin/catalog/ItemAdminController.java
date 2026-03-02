package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.catalog.domain.Item;
import com.blinc.xpos.modules.catalog.domain.ItemImage;
import com.blinc.xpos.modules.catalog.service.ItemImageService;
import com.blinc.xpos.modules.catalog.service.ItemService;
import jakarta.validation.Valid;
import java.util.List;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/items")
public class ItemAdminController {

  private final ItemService itemService;
  private final ItemImageService itemImageService;
  private final PageRequestFactory pageRequestFactory;

  public ItemAdminController(
      ItemService itemService,
      ItemImageService itemImageService,
      PageRequestFactory pageRequestFactory) {
    this.itemService = Objects.requireNonNull(itemService, "itemService");
    this.itemImageService = Objects.requireNonNull(itemImageService, "itemImageService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
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
            request.active());
    if (request.imageUrl() != null && !request.imageUrl().isBlank()) {
      itemImageService.add(orgId, item.getId(), request.imageUrl().trim(), 0, true);
    }
    String primaryImageUrl = resolvePrimaryImageUrl(orgId, item.getId());
    return toResponse(item, primaryImageUrl);
  }

  @GetMapping
  public Page<ItemResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    var page = itemService.list(orgId, normalized);
    List<UUID> itemIds = page.getContent().stream().map(Item::getId).toList();
    var primaryUrls = itemImageService.findPrimaryUrlsByItemIds(orgId, itemIds);
    return page.map(item -> toResponse(item, primaryUrls.get(item.getId())));
  }

  @GetMapping("/{itemId}")
  public ItemResponse get(@PathVariable UUID orgId, @PathVariable UUID itemId) {
    Item item = itemService.require(orgId, itemId);
    String primaryImageUrl = resolvePrimaryImageUrl(orgId, itemId);
    return toResponse(item, primaryImageUrl);
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
            request.active());
    if (request.imageUrl() != null && !request.imageUrl().isBlank()) {
      for (ItemImage existing : itemImageService.listByItem(orgId, itemId)) {
        itemImageService.remove(orgId, itemId, existing.getId());
      }
      itemImageService.add(orgId, itemId, request.imageUrl().trim(), 0, true);
    }
    String primaryImageUrl = resolvePrimaryImageUrl(orgId, itemId);
    return toResponse(updated, primaryImageUrl);
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

  private ItemResponse toResponse(Item item, String primaryImageUrl) {
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
        primaryImageUrl,
        item.getCreatedAt(),
        item.getUpdatedAt());
  }
}
