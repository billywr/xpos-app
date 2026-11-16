package com.blinc.xpos.modules.catalog.service.impl;

import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.catalog.domain.Category;
import com.blinc.xpos.modules.catalog.repository.CategoryRepository;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.catalog.service.CategoryService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryServiceImpl implements CategoryService {

  private final CategoryRepository categoryRepository;
  private final ItemRepository itemRepository;
  private final OrgService orgService;
  private final Clock clock;

  public CategoryServiceImpl(
      CategoryRepository categoryRepository,
      ItemRepository itemRepository,
      OrgService orgService,
      Clock clock) {
    this.categoryRepository = Objects.requireNonNull(categoryRepository, "categoryRepository");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Category create(UUID orgId, UUID parentId, String name, String type) {
    var org = orgService.require(orgId);
    Category category = new Category();
    category.setOrg(org);
    if (parentId != null) {
      category.setParent(require(orgId, parentId));
    }
    category.setName(name);
    category.setType(type);
    Instant now = Instant.now(clock);
    category.setCreatedAt(now);
    category.setUpdatedAt(now);
    return categoryRepository.save(category);
  }

  @Override
  @Transactional(readOnly = true)
  public Category require(UUID orgId, UUID categoryId) {
    return categoryRepository
        .findByIdAndOrgId(categoryId, orgId)
        .orElseThrow(() -> new NotFoundException("CATEGORY_NOT_FOUND", "Category not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Category> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return categoryRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public Category update(UUID orgId, UUID categoryId, UUID parentId, String name, String type) {
    Category category = require(orgId, categoryId);
    if (parentId != null) {
      category.setParent(require(orgId, parentId));
    } else {
      category.setParent(null);
    }
    category.setName(name);
    category.setType(type);
    category.setUpdatedAt(Instant.now(clock));
    return categoryRepository.save(category);
  }

  @Override
  @Transactional
  public void delete(UUID orgId, UUID categoryId) {
    Category category = require(orgId, categoryId);
    if (itemRepository.countByOrgIdAndCategoryId(orgId, categoryId) > 0) {
      throw new ConflictException(
          "CATEGORY_IN_USE", "Cannot delete category: it has items. Move or delete items first.");
    }
    if (categoryRepository.countByOrgIdAndParentId(orgId, categoryId) > 0) {
      throw new ConflictException(
          "CATEGORY_HAS_CHILDREN",
          "Cannot delete category: it has subcategories. Delete subcategories first.");
    }
    categoryRepository.delete(category);
  }
}
