package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.CategoryCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.CategoryResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.CategoryUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.catalog.domain.Category;
import com.blinc.xpos.modules.catalog.service.CategoryService;
import jakarta.validation.Valid;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/categories")
public class CategoryAdminController {

  private final CategoryService categoryService;
  private final PageRequestFactory pageRequestFactory;

  public CategoryAdminController(
      CategoryService categoryService, PageRequestFactory pageRequestFactory) {
    this.categoryService = Objects.requireNonNull(categoryService, "categoryService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public CategoryResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody CategoryCreateRequest request) {
    Category category =
        categoryService.create(orgId, request.parentId(), request.name(), request.type());
    return toResponse(category);
  }

  @GetMapping
  public Page<CategoryResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return categoryService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{categoryId}")
  public CategoryResponse get(@PathVariable UUID orgId, @PathVariable UUID categoryId) {
    return toResponse(categoryService.require(orgId, categoryId));
  }

  @PatchMapping("/{categoryId}")
  public CategoryResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID categoryId,
      @Valid @RequestBody CategoryUpdateRequest request) {
    Category updated =
        categoryService.update(
            orgId, categoryId, request.parentId(), request.name(), request.type());
    return toResponse(updated);
  }

  @DeleteMapping("/{categoryId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID categoryId) {
    categoryService.delete(orgId, categoryId);
  }

  private CategoryResponse toResponse(Category category) {
    return new CategoryResponse(
        category.getId(),
        category.getOrg().getId(),
        category.getParent() != null ? category.getParent().getId() : null,
        category.getName(),
        category.getType(),
        category.getCreatedAt(),
        category.getUpdatedAt());
  }
}
