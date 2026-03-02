package com.blinc.xpos.api.v1.admin.catalog;

import com.blinc.xpos.api.v1.admin.catalog.dto.UomCreateRequest;
import com.blinc.xpos.api.v1.admin.catalog.dto.UomResponse;
import com.blinc.xpos.api.v1.admin.catalog.dto.UomUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.catalog.domain.Uom;
import com.blinc.xpos.modules.catalog.service.UomService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/uoms")
public class UomAdminController {

  private final UomService uomService;
  private final PageRequestFactory pageRequestFactory;

  public UomAdminController(UomService uomService, PageRequestFactory pageRequestFactory) {
    this.uomService = Objects.requireNonNull(uomService, "uomService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public UomResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody UomCreateRequest request) {
    Uom uom = uomService.create(orgId, request.name(), request.symbol());
    return toResponse(uom);
  }

  @GetMapping
  public Page<UomResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return uomService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{uomId}")
  public UomResponse get(@PathVariable UUID orgId, @PathVariable UUID uomId) {
    return toResponse(uomService.require(orgId, uomId));
  }

  @PatchMapping("/{uomId}")
  public UomResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID uomId,
      @Valid @RequestBody UomUpdateRequest request) {
    Uom updated = uomService.update(orgId, uomId, request.name(), request.symbol());
    return toResponse(updated);
  }

  @DeleteMapping("/{uomId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID uomId) {
    uomService.delete(orgId, uomId);
  }

  private UomResponse toResponse(Uom uom) {
    return new UomResponse(
        uom.getId(),
        uom.getOrg().getId(),
        uom.getName(),
        uom.getSymbol(),
        uom.getCreatedAt());
  }
}
