package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.BranchCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.BranchResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.BranchUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches")
public class BranchAdminController {

  private final BranchService branchService;
  private final PageRequestFactory pageRequestFactory;

  public BranchAdminController(BranchService branchService, PageRequestFactory pageRequestFactory) {
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BranchResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody BranchCreateRequest request) {
    Branch branch =
        branchService.create(
            orgId,
            request.businessId(),
            request.name(),
            request.timezone(),
            request.currency(),
            request.addressJson(),
            request.taxAgencyConfigId(),
            request.receiptTemplateId());
    return toResponse(branch);
  }

  @GetMapping
  public Page<BranchResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return branchService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{branchId}")
  public BranchResponse get(@PathVariable UUID orgId, @PathVariable UUID branchId) {
    return toResponse(branchService.require(orgId, branchId));
  }

  @PatchMapping("/{branchId}")
  public BranchResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody BranchUpdateRequest request) {
    Branch updated =
        branchService.update(
            orgId,
            branchId,
            request.name(),
            request.timezone(),
            request.currency(),
            request.addressJson(),
            request.taxAgencyConfigId(),
            request.receiptTemplateId(),
            request.status());
    return toResponse(updated);
  }

  @DeleteMapping("/{branchId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID branchId) {
    branchService.softDelete(orgId, branchId);
  }

  private BranchResponse toResponse(Branch branch) {
    return new BranchResponse(
        branch.getId(),
        branch.getOrg().getId(),
        branch.getBusiness().getId(),
        branch.getName(),
        branch.getTimezone(),
        branch.getCurrency(),
        branch.getAddressJson(),
        branch.getTaxAgencyConfig() == null ? null : branch.getTaxAgencyConfig().getId(),
        branch.getReceiptTemplate() == null ? null : branch.getReceiptTemplate().getId(),
        branch.getStatus(),
        branch.getCreatedAt(),
        branch.getUpdatedAt());
  }
}
