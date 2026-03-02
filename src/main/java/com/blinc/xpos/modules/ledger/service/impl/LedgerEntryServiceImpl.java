package com.blinc.xpos.modules.ledger.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.ledger.domain.LedgerEntry;
import com.blinc.xpos.modules.ledger.repository.LedgerEntryRepository;
import com.blinc.xpos.modules.ledger.service.LedgerEntryService;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LedgerEntryServiceImpl implements LedgerEntryService {

  private final LedgerEntryRepository ledgerEntryRepository;
  private final OrgService orgService;
  private final BranchService branchService;

  public LedgerEntryServiceImpl(
      LedgerEntryRepository ledgerEntryRepository,
      OrgService orgService,
      BranchService branchService) {
    this.ledgerEntryRepository = Objects.requireNonNull(ledgerEntryRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.branchService = Objects.requireNonNull(branchService);
  }

  @Override
  @Transactional(readOnly = true)
  public LedgerEntry require(UUID orgId, UUID entryId) {
    return ledgerEntryRepository
        .findByIdAndOrgId(entryId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "LEDGER_ENTRY_NOT_FOUND", "Ledger entry not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<LedgerEntry> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return ledgerEntryRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<LedgerEntry> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return ledgerEntryRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<LedgerEntry> listByBranchAndDate(
      UUID orgId, UUID branchId, LocalDate businessDate, Pageable pageable) {
    branchService.require(orgId, branchId);
    return ledgerEntryRepository.findAllByOrgIdAndBranchIdAndBusinessDate(
        orgId, branchId, businessDate, pageable);
  }
}
