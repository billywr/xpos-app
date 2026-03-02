package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ModifierOptionCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ModifierOptionResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.ModifierOptionUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.catalog.domain.ModifierOption;
import com.blinc.xpos.modules.catalog.service.ModifierOptionService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/modifier-groups/{modifierGroupId}/options")
public class ModifierOptionAdminController {

  private final ModifierOptionService modifierOptionService;
  private final PageRequestFactory pageRequestFactory;

  public ModifierOptionAdminController(
      ModifierOptionService modifierOptionService, PageRequestFactory pageRequestFactory) {
    this.modifierOptionService =
        Objects.requireNonNull(modifierOptionService, "modifierOptionService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ModifierOptionResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID modifierGroupId,
      @Valid @RequestBody ModifierOptionCreateRequest request) {
    ModifierOption option =
        modifierOptionService.create(
            orgId,
            modifierGroupId,
            request.name(),
            request.priceDelta(),
            request.itemId());
    return toResponse(option);
  }

  @GetMapping
  public Page<ModifierOptionResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID modifierGroupId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return modifierOptionService
        .listByGroup(orgId, modifierGroupId, normalized)
        .map(this::toResponse);
  }

  @GetMapping("/{modifierOptionId}")
  public ModifierOptionResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID modifierGroupId,
      @PathVariable UUID modifierOptionId) {
    return toResponse(
        modifierOptionService.requireInGroup(orgId, modifierGroupId, modifierOptionId));
  }

  @PatchMapping("/{modifierOptionId}")
  public ModifierOptionResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID modifierGroupId,
      @PathVariable UUID modifierOptionId,
      @Valid @RequestBody ModifierOptionUpdateRequest request) {
    modifierOptionService.requireInGroup(orgId, modifierGroupId, modifierOptionId);
    ModifierOption updated =
        modifierOptionService.update(
            orgId, modifierOptionId, request.name(), request.priceDelta(), request.itemId());
    return toResponse(updated);
  }

  private ModifierOptionResponse toResponse(ModifierOption option) {
    return new ModifierOptionResponse(
        option.getId(),
        option.getOrg().getId(),
        option.getModifierGroup().getId(),
        option.getName(),
        option.getPriceDelta(),
        option.getItem() != null ? option.getItem().getId() : null,
        option.getCreatedAt());
  }
}
