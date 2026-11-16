package com.blinc.xpos.modules.auditvault.service;

import com.blinc.xpos.modules.auditvault.domain.AuditLog;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditLogService {

  /** Appends an audit log entry. Call from critical flows (sale complete, void, day close). */
  AuditLog append(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID actorStaffUserId,
      String action,
      String entityType,
      UUID entityId,
      JsonNode beforeJson,
      JsonNode afterJson);

  AuditLog require(UUID orgId, UUID logId);

  Page<AuditLog> list(UUID orgId, Pageable pageable);

  Page<AuditLog> listByBranch(UUID orgId, UUID branchId, Pageable pageable);
}
