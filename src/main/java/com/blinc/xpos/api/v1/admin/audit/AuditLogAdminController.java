package com.blinc.xpos.api.v1.admin.audit;

import com.blinc.xpos.api.v1.admin.audit.dto.AuditLogResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.auditvault.domain.AuditLog;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/audit-logs")
public class AuditLogAdminController {

  private final AuditLogService auditLogService;
  private final PageRequestFactory pageRequestFactory;

  public AuditLogAdminController(
      AuditLogService auditLogService, PageRequestFactory pageRequestFactory) {
    this.auditLogService = Objects.requireNonNull(auditLogService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @GetMapping
  public Page<AuditLogResponse> list(
      @PathVariable UUID orgId, @RequestParam(required = false) UUID branchId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    if (branchId != null) {
      return auditLogService
          .listByBranch(orgId, branchId, normalized)
          .map(AuditLogAdminController::toResponse);
    }
    return auditLogService.list(orgId, normalized).map(AuditLogAdminController::toResponse);
  }

  @GetMapping("/{logId}")
  public AuditLogResponse get(@PathVariable UUID orgId, @PathVariable UUID logId) {
    return toResponse(auditLogService.require(orgId, logId));
  }

  private static AuditLogResponse toResponse(AuditLog a) {
    return new AuditLogResponse(
        a.getId(),
        a.getOrg().getId(),
        a.getBranch() != null ? a.getBranch().getId() : null,
        a.getTerminal() != null ? a.getTerminal().getId() : null,
        a.getActorStaffUser() != null ? a.getActorStaffUser().getId() : null,
        a.getAction(),
        a.getEntityType(),
        a.getEntityId(),
        a.getBeforeJson(),
        a.getAfterJson(),
        a.getCreatedAt());
  }
}
