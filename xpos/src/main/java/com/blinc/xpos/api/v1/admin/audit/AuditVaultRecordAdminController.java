package com.blinc.xpos.api.v1.admin.audit;

import com.blinc.xpos.api.v1.admin.audit.dto.AuditVaultRecordResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.auditvault.domain.AuditVaultRecord;
import com.blinc.xpos.modules.auditvault.service.AuditVaultRecordService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/audit-vault-records")
public class AuditVaultRecordAdminController {

  private final AuditVaultRecordService auditVaultRecordService;
  private final PageRequestFactory pageRequestFactory;

  public AuditVaultRecordAdminController(
      AuditVaultRecordService auditVaultRecordService, PageRequestFactory pageRequestFactory) {
    this.auditVaultRecordService = Objects.requireNonNull(auditVaultRecordService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @GetMapping
  public Page<AuditVaultRecordResponse> list(
      @PathVariable UUID orgId, @RequestParam(required = false) UUID branchId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    if (branchId != null) {
      return auditVaultRecordService
          .listByBranch(orgId, branchId, normalized)
          .map(AuditVaultRecordAdminController::toResponse);
    }
    return auditVaultRecordService
        .list(orgId, normalized)
        .map(AuditVaultRecordAdminController::toResponse);
  }

  @GetMapping("/{recordId}")
  public AuditVaultRecordResponse get(@PathVariable UUID orgId, @PathVariable UUID recordId) {
    return toResponse(auditVaultRecordService.require(orgId, recordId));
  }

  private static AuditVaultRecordResponse toResponse(AuditVaultRecord v) {
    return new AuditVaultRecordResponse(
        v.getId(),
        v.getOrg().getId(),
        v.getBranch().getId(),
        v.getTerminal() != null ? v.getTerminal().getId() : null,
        v.getEventType(),
        v.getEventId(),
        v.getPayloadHash(),
        v.getPreviousHash(),
        v.getHash(),
        v.getCreatedAt());
  }
}
