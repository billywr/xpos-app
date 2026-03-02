package com.blinc.xpos.modules.auditvault.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.auditvault.domain.AuditLog;
import com.blinc.xpos.modules.auditvault.repository.AuditLogRepository;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogServiceImpl implements AuditLogService {

  private final AuditLogRepository auditLogRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final TerminalService terminalService;
  private final StaffUserService staffUserService;
  private final Clock clock;

  public AuditLogServiceImpl(
      AuditLogRepository auditLogRepository,
      OrgService orgService,
      BranchService branchService,
      TerminalService terminalService,
      StaffUserService staffUserService,
      Clock clock) {
    this.auditLogRepository = Objects.requireNonNull(auditLogRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.branchService = Objects.requireNonNull(branchService);
    this.terminalService = Objects.requireNonNull(terminalService);
    this.staffUserService = Objects.requireNonNull(staffUserService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public AuditLog append(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID actorStaffUserId,
      String action,
      String entityType,
      UUID entityId,
      JsonNode beforeJson,
      JsonNode afterJson) {
    var org = orgService.require(orgId);
    Branch branch = branchId != null ? branchService.require(orgId, branchId) : null;
    Terminal terminal = terminalId != null ? terminalService.require(orgId, terminalId) : null;
    StaffUser actor =
        actorStaffUserId != null ? staffUserService.require(orgId, actorStaffUserId) : null;
    Instant now = Instant.now(clock);
    AuditLog log = new AuditLog();
    log.setOrg(org);
    log.setBranch(branch);
    log.setTerminal(terminal);
    log.setActorStaffUser(actor);
    log.setAction(action != null ? action : "");
    log.setEntityType(entityType != null ? entityType : "");
    log.setEntityId(entityId);
    log.setBeforeJson(beforeJson);
    log.setAfterJson(afterJson);
    log.setCreatedAt(now);
    return auditLogRepository.save(log);
  }

  @Override
  @Transactional(readOnly = true)
  public AuditLog require(UUID orgId, UUID logId) {
    return auditLogRepository
        .findByIdAndOrgId(logId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "AUDIT_LOG_NOT_FOUND", "Audit log entry not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<AuditLog> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return auditLogRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<AuditLog> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return auditLogRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }
}
