package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.modules.catalog.service.ItemImageUploadService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ItemImageUploadServiceImpl implements ItemImageUploadService {

  private static final Set<String> ALLOWED_CONTENT_TYPES =
      Set.of("image/jpeg", "image/png", "image/webp", "image/jpg");
  private static final String URL_PREFIX = "/uploads/items/";
  private static final long MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  private final Path uploadRoot;

  public ItemImageUploadServiceImpl(@Value("${xpos.upload.dir:uploads}") String uploadDir) {
    String baseDir = uploadDir.replaceAll("/$", "");
    this.uploadRoot = Path.of(baseDir, "items").toAbsolutePath();
  }

  @Override
  public String store(UUID orgId, MultipartFile file) {
    Objects.requireNonNull(orgId, "orgId");
    Objects.requireNonNull(file, "file");
    if (file.isEmpty()) {
      throw new IllegalArgumentException("File is empty");
    }
    String contentType = file.getContentType();
    if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
      throw new IllegalArgumentException(
          "Only JPEG, PNG, and WebP images are allowed. Received: " + contentType);
    }
    if (file.getSize() > MAX_SIZE_BYTES) {
      throw new IllegalArgumentException("File size exceeds 5MB limit. Size: " + file.getSize());
    }
    String ext = extensionForContentType(contentType);
    String filename = UUID.randomUUID() + "." + ext;
    Path dir = uploadRoot.resolve(orgId.toString());
    try {
      Files.createDirectories(dir);
      Path target = dir.resolve(filename);
      file.transferTo(target.toFile());
      return URL_PREFIX + orgId + "/" + filename;
    } catch (IOException e) {
      throw new IllegalStateException("Failed to store image: " + e.getMessage(), e);
    }
  }

  private static String extensionForContentType(String contentType) {
    if (contentType == null) {
      return "bin";
    }
    String ct = contentType.toLowerCase();
    if ("image/jpeg".equals(ct) || "image/jpg".equals(ct)) {
      return "jpg";
    } else if ("image/png".equals(ct)) {
      return "png";
    } else if ("image/webp".equals(ct)) {
      return "webp";
    } else {
      return "bin";
    }
  }
}
