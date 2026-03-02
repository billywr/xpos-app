package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.ModifierGroupCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.ModifierGroupResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.ModifierGroupUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.catalog.domain.ModifierGroup;
import com.blinc.xpos.modules.catalog.service.ModifierGroupService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/modifier-groups")
public class ModifierGroupAdminController {

  private final ModifierGroupService modifierGroupService;
  private final PageRequestFactory pageRequestFactory;

  public ModifierGroupAdminController(
      ModifierGroupService modifierGroupService, PageRequestFactory pageRequestFactory) {
    this.modifierGroupService =
        Objects.requireNonNull(modifierGroupService, "modifierGroupService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ModifierGroupResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody ModifierGroupCreateRequest request) {
    ModifierGroup group =
        modifierGroupService.create(
            orgId,
            request.name(),
            request.minSelect(),
            request.maxSelect(),
            request.required());
    return toResponse(group);
  }

  @GetMapping
  public Page<ModifierGroupResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return modifierGroupService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{modifierGroupId}")
  public ModifierGroupResponse get(
      @PathVariable UUID orgId, @PathVariable UUID modifierGroupId) {
    return toResponse(modifierGroupService.require(orgId, modifierGroupId));
  }

  @PatchMapping("/{modifierGroupId}")
  public ModifierGroupResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID modifierGroupId,
      @Valid @RequestBody ModifierGroupUpdateRequest request) {
    ModifierGroup updated =
        modifierGroupService.update(
            orgId,
            modifierGroupId,
            request.name(),
            request.minSelect(),
            request.maxSelect(),
            request.required());
    return toResponse(updated);
  }

  private ModifierGroupResponse toResponse(ModifierGroup group) {
    return new ModifierGroupResponse(
        group.getId(),
        group.getOrg().getId(),
        group.getName(),
        group.getMinSelect(),
        group.getMaxSelect(),
        group.getRequired(),
        group.getCreatedAt(),
        group.getUpdatedAt());
  }
}
