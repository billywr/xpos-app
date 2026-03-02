package com.blinc.xpos.api.v1.admin.compliance;

import com.blinc.xpos.api.v1.admin.compliance.dto.TaxAgencyConfigCreateRequest;
import com.blinc.xpos.api.v1.admin.compliance.dto.TaxAgencyConfigResponse;
import com.blinc.xpos.api.v1.admin.compliance.dto.TaxAgencyConfigUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.compliance.domain.TaxAgencyConfig;
import com.blinc.xpos.modules.compliance.service.TaxAgencyConfigService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/tax-agency-configs")
public class TaxAgencyConfigAdminController {

  private final TaxAgencyConfigService service;
  private final PageRequestFactory pageRequestFactory;

  public TaxAgencyConfigAdminController(
      TaxAgencyConfigService service,
      PageRequestFactory pageRequestFactory) {
    this.service = Objects.requireNonNull(service);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TaxAgencyConfigResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody TaxAgencyConfigCreateRequest request) {
    TaxAgencyConfig created = service.create(orgId, request.name(), request.vatStandardRate(),
        request.vatReducedRate(), request.supportsEtims(), request.etimsMappingJson());
    return toResponse(created);
  }

  @GetMapping
  public Page<TaxAgencyConfigResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("name").ascending());
    return service.list(orgId, normalized).map(TaxAgencyConfigAdminController::toResponse);
  }

  @GetMapping("/{configId}")
  public TaxAgencyConfigResponse get(@PathVariable UUID orgId, @PathVariable UUID configId) {
    return toResponse(service.require(orgId, configId));
  }

  @PatchMapping("/{configId}")
  public TaxAgencyConfigResponse update(
      @PathVariable UUID orgId, @PathVariable UUID configId,
      @Valid @RequestBody TaxAgencyConfigUpdateRequest request) {
    TaxAgencyConfig updated = service.update(orgId, configId, request.name(),
        request.vatStandardRate(), request.vatReducedRate(),
        request.supportsEtims(), request.etimsMappingJson());
    return toResponse(updated);
  }

  private static TaxAgencyConfigResponse toResponse(TaxAgencyConfig t) {
    return new TaxAgencyConfigResponse(t.getId(), t.getOrg().getId(), t.getName(),
        t.getVatStandardRate(), t.getVatReducedRate(), t.getSupportsEtims(),
        t.getEtimsMappingJson(), t.getCreatedAt(), t.getUpdatedAt());
  }
}
