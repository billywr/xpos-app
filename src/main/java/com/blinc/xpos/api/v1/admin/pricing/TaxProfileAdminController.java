package com.blinc.xpos.api.v1.admin.pricing;

import com.blinc.xpos.api.v1.admin.pricing.dto.TaxProfileCreateRequest;
import com.blinc.xpos.api.v1.admin.pricing.dto.TaxProfileResponse;
import com.blinc.xpos.api.v1.admin.pricing.dto.TaxProfileUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.pricing.domain.TaxProfile;
import com.blinc.xpos.modules.pricing.service.TaxProfileService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/tax-profiles")
public class TaxProfileAdminController {

  private final TaxProfileService taxProfileService;
  private final PageRequestFactory pageRequestFactory;

  public TaxProfileAdminController(
      TaxProfileService taxProfileService, PageRequestFactory pageRequestFactory) {
    this.taxProfileService = Objects.requireNonNull(taxProfileService, "taxProfileService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TaxProfileResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody TaxProfileCreateRequest request) {
    TaxProfile profile =
        taxProfileService.create(
            orgId,
            request.name(),
            request.vatCategory(),
            request.serviceChargeRate(),
            request.levyRate());
    return toResponse(profile);
  }

  @GetMapping
  public Page<TaxProfileResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return taxProfileService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{taxProfileId}")
  public TaxProfileResponse get(@PathVariable UUID orgId, @PathVariable UUID taxProfileId) {
    return toResponse(taxProfileService.require(orgId, taxProfileId));
  }

  @PatchMapping("/{taxProfileId}")
  public TaxProfileResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID taxProfileId,
      @Valid @RequestBody TaxProfileUpdateRequest request) {
    TaxProfile updated =
        taxProfileService.update(
            orgId,
            taxProfileId,
            request.name(),
            request.vatCategory(),
            request.serviceChargeRate(),
            request.levyRate());
    return toResponse(updated);
  }

  private TaxProfileResponse toResponse(TaxProfile profile) {
    return new TaxProfileResponse(
        profile.getId(),
        profile.getOrg().getId(),
        profile.getName(),
        profile.getVatCategory(),
        profile.getServiceChargeRate(),
        profile.getLevyRate(),
        profile.getCreatedAt(),
        profile.getUpdatedAt());
  }
}
