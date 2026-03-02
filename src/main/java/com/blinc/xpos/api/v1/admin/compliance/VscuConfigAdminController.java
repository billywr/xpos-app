package com.blinc.xpos.api.v1.admin.compliance;

import com.blinc.xpos.api.v1.admin.compliance.dto.VscuConfigCreateRequest;
import com.blinc.xpos.api.v1.admin.compliance.dto.VscuConfigResponse;
import com.blinc.xpos.api.v1.admin.compliance.dto.VscuConfigUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.compliance.domain.VscuConfig;
import com.blinc.xpos.modules.compliance.service.VscuConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/vscu-configs")
public class VscuConfigAdminController {

  private final VscuConfigService vscuConfigService;
  private final PageRequestFactory pageRequestFactory;
  private final ObjectMapper objectMapper;

  public VscuConfigAdminController(
      VscuConfigService vscuConfigService,
      PageRequestFactory pageRequestFactory,
      ObjectMapper objectMapper) {
    this.vscuConfigService = Objects.requireNonNull(vscuConfigService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
    this.objectMapper = Objects.requireNonNull(objectMapper);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public VscuConfigResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody VscuConfigCreateRequest request) {
    JsonNode config = objectMapper.valueToTree(request.configJson());
    VscuConfig created = vscuConfigService.create(orgId, request.branchId(), config);
    return toResponse(created);
  }

  @GetMapping
  public Page<VscuConfigResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("branch.id").ascending());
    return vscuConfigService.list(orgId, normalized)
        .map(VscuConfigAdminController::toResponse);
  }

  @GetMapping("/{configId}")
  public VscuConfigResponse get(@PathVariable UUID orgId, @PathVariable UUID configId) {
    return toResponse(vscuConfigService.require(orgId, configId));
  }

  @PatchMapping("/{configId}")
  public VscuConfigResponse update(
      @PathVariable UUID orgId, @PathVariable UUID configId,
      @Valid @RequestBody VscuConfigUpdateRequest request) {
    JsonNode config = request.configJson() != null ? objectMapper.valueToTree(request.configJson()) : null;
    VscuConfig updated = vscuConfigService.update(orgId, configId, config, request.status());
    return toResponse(updated);
  }

  private static VscuConfigResponse toResponse(VscuConfig v) {
    return new VscuConfigResponse(v.getId(), v.getOrg().getId(), v.getBranch().getId(),
        v.getConfigJson(), v.getStatus(), v.getCreatedAt(), v.getUpdatedAt());
  }
}
