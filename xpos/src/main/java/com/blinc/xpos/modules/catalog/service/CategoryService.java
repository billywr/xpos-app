package com.blinc.xpos.modules.catalog.service;

import com.blinc.xpos.modules.catalog.domain.Category;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CategoryService {

  Category create(UUID orgId, UUID parentId, String name, String type);

  Category require(UUID orgId, UUID categoryId);

  Page<Category> list(UUID orgId, Pageable pageable);

  Category update(UUID orgId, UUID categoryId, UUID parentId, String name, String type);

  void delete(UUID orgId, UUID categoryId);
}
