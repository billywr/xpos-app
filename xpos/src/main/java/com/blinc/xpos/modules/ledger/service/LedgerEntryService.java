package com.blinc.xpos.modules.ledger.service;

import com.blinc.xpos.modules.ledger.domain.LedgerEntry;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface LedgerEntryService {

  LedgerEntry require(UUID orgId, UUID entryId);

  Page<LedgerEntry> list(UUID orgId, Pageable pageable);

  Page<LedgerEntry> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  Page<LedgerEntry> listByBranchAndDate(
      UUID orgId, UUID branchId, LocalDate businessDate, Pageable pageable);
}
