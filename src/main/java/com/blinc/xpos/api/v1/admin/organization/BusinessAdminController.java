package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.BusinessCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.BusinessResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.BusinessUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.Business;
import com.blinc.xpos.modules.organization.service.BusinessService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/businesses")
public class BusinessAdminController {

  private final BusinessService businessService;
  private final PageRequestFactory pageRequestFactory;

  public BusinessAdminController(
      BusinessService businessService, PageRequestFactory pageRequestFactory) {
    this.businessService = Objects.requireNonNull(businessService, "businessService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BusinessResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody BusinessCreateRequest request) {
    Business business =
        businessService.create(
            orgId,
            request.legalName(),
            request.kraPin(),
            request.logoUrl(),
            request.receiptFooter());
    return toResponse(business);
  }

  @GetMapping
  public Page<BusinessResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return businessService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{businessId}")
  public BusinessResponse get(@PathVariable UUID orgId, @PathVariable UUID businessId) {
    return toResponse(businessService.require(orgId, businessId));
  }

  @PatchMapping("/{businessId}")
  public BusinessResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID businessId,
      @Valid @RequestBody BusinessUpdateRequest request) {
    Business updated =
        businessService.update(
            orgId,
            businessId,
            request.legalName(),
            request.kraPin(),
            request.logoUrl(),
            request.receiptFooter(),
            request.status());
    return toResponse(updated);
  }

  @DeleteMapping("/{businessId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      @PathVariable UUID orgId, @PathVariable UUID businessId) {
    businessService.softDelete(orgId, businessId);
  }

  private BusinessResponse toResponse(Business business) {
    return new BusinessResponse(
        business.getId(),
        business.getOrg().getId(),
        business.getLegalName(),
        business.getKraPin(),
        business.getLogoUrl(),
        business.getReceiptFooter(),
        business.getStatus(),
        business.getCreatedAt(),
        business.getUpdatedAt());
  }
}
