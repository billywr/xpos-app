package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemImageCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemImageResponse;
import com.blinc.xpos.modules.catalog.domain.ItemImage;
import com.blinc.xpos.modules.catalog.service.ItemImageService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/items/{itemId}/images")
public class ItemImageAdminController {

  private final ItemImageService itemImageService;

  public ItemImageAdminController(ItemImageService itemImageService) {
    this.itemImageService = Objects.requireNonNull(itemImageService, "itemImageService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ItemImageResponse add(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @Valid @RequestBody ItemImageCreateRequest request) {
    ItemImage image =
        itemImageService.add(
            orgId, itemId, request.url(), request.sortOrder(), request.isPrimary());
    return toResponse(image);
  }

  @GetMapping
  public List<ItemImageResponse> list(@PathVariable UUID orgId, @PathVariable UUID itemId) {
    return itemImageService.listByItem(orgId, itemId).stream().map(this::toResponse).toList();
  }

  @GetMapping("/{imageId}")
  public ItemImageResponse get(
      @PathVariable UUID orgId, @PathVariable UUID itemId, @PathVariable UUID imageId) {
    return toResponse(itemImageService.requireInItem(orgId, itemId, imageId));
  }

  @DeleteMapping("/{imageId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(
      @PathVariable UUID orgId, @PathVariable UUID itemId, @PathVariable UUID imageId) {
    itemImageService.remove(orgId, itemId, imageId);
  }

  private ItemImageResponse toResponse(ItemImage image) {
    return new ItemImageResponse(
        image.getId(),
        image.getItem().getId(),
        image.getUrl(),
        image.getSortOrder(),
        Boolean.TRUE.equals(image.getIsPrimary()),
        image.getCreatedAt());
  }
}
