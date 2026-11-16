package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ItemImageUploadResponse;
import com.blinc.xpos.modules.catalog.service.ItemImageUploadService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/item-images")
public class ItemImageUploadController {

  private final ItemImageUploadService uploadService;

  public ItemImageUploadController(ItemImageUploadService uploadService) {
    this.uploadService = Objects.requireNonNull(uploadService, "uploadService");
  }

  @PostMapping("/upload")
  @ResponseStatus(HttpStatus.CREATED)
  public ItemImageUploadResponse upload(
      @PathVariable UUID orgId, @RequestParam("file") MultipartFile file) {
    String url = uploadService.store(orgId, file);
    return new ItemImageUploadResponse(url);
  }
}
