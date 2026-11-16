package com.blinc.xpos.modules.auditvault.service;

import com.blinc.xpos.modules.auditvault.domain.AuditVaultRecord;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditVaultRecordService {

  /** Appends a tamper-evident vault record (hash-chained). Call from critical flows. */
  AuditVaultRecord append(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      String eventType,
      UUID eventId,
      String payloadHash);

  AuditVaultRecord require(UUID orgId, UUID recordId);

  Page<AuditVaultRecord> list(UUID orgId, Pageable pageable);

  Page<AuditVaultRecord> listByBranch(UUID orgId, UUID branchId, Pageable pageable);
}
