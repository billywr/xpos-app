package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemBarcodeCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ItemBarcodeResponse;
import com.blinc.xpos.modules.catalog.domain.ItemBarcode;
import com.blinc.xpos.modules.catalog.service.ItemBarcodeService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/items/{itemId}/barcodes")
public class ItemBarcodeAdminController {

  private final ItemBarcodeService itemBarcodeService;

  public ItemBarcodeAdminController(ItemBarcodeService itemBarcodeService) {
    this.itemBarcodeService = Objects.requireNonNull(itemBarcodeService, "itemBarcodeService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ItemBarcodeResponse add(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @Valid @RequestBody ItemBarcodeCreateRequest request) {
    ItemBarcode barcode = itemBarcodeService.add(orgId, itemId, request.barcode());
    return toResponse(barcode);
  }

  @GetMapping
  public List<ItemBarcodeResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID itemId) {
    return itemBarcodeService.listByItem(orgId, itemId).stream()
        .map(this::toResponse)
        .toList();
  }

  @GetMapping("/{barcodeId}")
  public ItemBarcodeResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @PathVariable UUID barcodeId) {
    return toResponse(itemBarcodeService.requireInItem(orgId, itemId, barcodeId));
  }

  @DeleteMapping("/{barcodeId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(
      @PathVariable UUID orgId,
      @PathVariable UUID itemId,
      @PathVariable UUID barcodeId) {
    itemBarcodeService.remove(orgId, itemId, barcodeId);
  }

  private ItemBarcodeResponse toResponse(ItemBarcode barcode) {
    return new ItemBarcodeResponse(
        barcode.getId(),
        barcode.getItem().getId(),
        barcode.getBarcode(),
        barcode.getCreatedAt());
  }
}
