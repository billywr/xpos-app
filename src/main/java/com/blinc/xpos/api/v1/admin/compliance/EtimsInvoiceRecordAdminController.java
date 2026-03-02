package com.blinc.xpos.api.v1.admin.compliance;

import com.blinc.xpos.api.v1.admin.compliance.dto.EtimsInvoiceRecordCreateRequest;
import com.blinc.xpos.api.v1.admin.compliance.dto.EtimsInvoiceRecordResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.compliance.domain.EtimsInvoiceRecord;
import com.blinc.xpos.modules.compliance.service.EtimsInvoiceRecordService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/etims-invoice-records")
public class EtimsInvoiceRecordAdminController {

  private final EtimsInvoiceRecordService etimsInvoiceRecordService;
  private final PageRequestFactory pageRequestFactory;

  public EtimsInvoiceRecordAdminController(
      EtimsInvoiceRecordService etimsInvoiceRecordService,
      PageRequestFactory pageRequestFactory) {
    this.etimsInvoiceRecordService = Objects.requireNonNull(etimsInvoiceRecordService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public EtimsInvoiceRecordResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody EtimsInvoiceRecordCreateRequest request) {
    return toResponse(
        etimsInvoiceRecordService.create(orgId, branchId, request.saleId()));
  }

  @GetMapping
  public Page<EtimsInvoiceRecordResponse> list(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return etimsInvoiceRecordService.listByBranch(orgId, branchId, normalized)
        .map(EtimsInvoiceRecordAdminController::toResponse);
  }

  @GetMapping("/{recordId}")
  public EtimsInvoiceRecordResponse get(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID recordId) {
    return toResponse(etimsInvoiceRecordService.require(orgId, recordId));
  }

  @PostMapping("/{recordId}/submit")
  @ResponseStatus(HttpStatus.OK)
  public EtimsInvoiceRecordResponse submit(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID recordId) {
    return toResponse(etimsInvoiceRecordService.submit(orgId, recordId));
  }

  @PostMapping("/{recordId}/poll-status")
  @ResponseStatus(HttpStatus.OK)
  public EtimsInvoiceRecordResponse pollStatus(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID recordId) {
    return toResponse(etimsInvoiceRecordService.pollStatus(orgId, recordId));
  }

  private static EtimsInvoiceRecordResponse toResponse(EtimsInvoiceRecord e) {
    return new EtimsInvoiceRecordResponse(
        e.getId(), e.getOrg().getId(), e.getBranch().getId(), e.getSale().getId(),
        e.getSubmissionStatus(), e.getFiscalCode(), e.getQrPayload(),
        e.getSubmittedAt(), e.getLastError(), e.getCreatedAt(), e.getUpdatedAt());
  }
}
