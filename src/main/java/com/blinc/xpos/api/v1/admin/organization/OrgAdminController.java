package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.OrgContextResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.OrgUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.service.OrgContextService;
import com.blinc.xpos.modules.organization.service.OrgService;
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
@RequestMapping("/api/v1/admin/orgs")
public class OrgAdminController {

  private final OrgService orgService;
  private final OrgContextService orgContextService;
  private final PageRequestFactory pageRequestFactory;

  public OrgAdminController(
      OrgService orgService,
      OrgContextService orgContextService,
      PageRequestFactory pageRequestFactory) {
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.orgContextService = Objects.requireNonNull(orgContextService, "orgContextService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public OrgResponse create(@Valid @RequestBody OrgCreateRequest request) {
    Org org = orgService.create(request.name());
    return toResponse(org);
  }

  @GetMapping
  public Page<OrgResponse> list(Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return orgService.list(normalized).map(this::toResponse);
  }

  @GetMapping("/{orgId}/context")
  public OrgContextResponse getContext(@PathVariable UUID orgId) {
    return orgContextService.getContext(orgId);
  }

  @GetMapping("/{orgId}")
  public OrgResponse get(@PathVariable UUID orgId) {
    return toResponse(orgService.require(orgId));
  }

  @PatchMapping("/{orgId}")
  public OrgResponse update(
      @PathVariable UUID orgId, @Valid @RequestBody OrgUpdateRequest request) {
    Org updated = orgService.update(orgId, request.name(), request.status());
    return toResponse(updated);
  }

  @DeleteMapping("/{orgId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId) {
    orgService.softDelete(orgId);
  }

  private OrgResponse toResponse(Org org) {
    return new OrgResponse(
        org.getId(), org.getName(), org.getStatus(), org.getCreatedAt(), org.getUpdatedAt());
  }
}
