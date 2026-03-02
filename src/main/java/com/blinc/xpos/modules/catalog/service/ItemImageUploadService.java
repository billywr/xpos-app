package com.blinc.xpos.modules.catalog.service;

import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

/**
 * Service for uploading and storing item images on the filesystem.
 * Stores files under the configured upload directory (e.g. uploads/items/).
 */
public interface ItemImageUploadService {

  /**
   * Validates the file, stores it under uploads/items/{orgId}/, and returns
   * the URL path for the stored image (e.g. /uploads/items/{orgId}/{filename}).
   *
   * @param orgId   organization ID (used for directory scoping)
   * @param file    the uploaded image file
   * @return the URL path to access the image (relative, e.g. /uploads/items/...)
   * @throws IllegalArgumentException if file is null, empty, or not an allowed image type
   */
  String store(UUID orgId, MultipartFile file);
}
