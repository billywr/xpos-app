package com.blinc.xpos.modules.ledger.service.impl;

import com.blinc.xpos.common.constants.enums.LedgerAccountType;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.ledger.domain.LedgerAccount;
import com.blinc.xpos.modules.ledger.repository.LedgerAccountRepository;
import com.blinc.xpos.modules.ledger.service.LedgerAccountService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LedgerAccountServiceImpl implements LedgerAccountService {

  private final LedgerAccountRepository ledgerAccountRepository;
  private final OrgService orgService;
  private final Clock clock;

  public LedgerAccountServiceImpl(
      LedgerAccountRepository ledgerAccountRepository,
      OrgService orgService,
      Clock clock) {
    this.ledgerAccountRepository = Objects.requireNonNull(ledgerAccountRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public LedgerAccount create(UUID orgId, String code, String name, LedgerAccountType accountType) {
    var org = orgService.require(orgId);
    if (ledgerAccountRepository.findByOrgIdAndCode(orgId, code).isPresent()) {
      throw new IllegalArgumentException("Ledger account already exists with code: " + code);
    }
    LedgerAccount account = new LedgerAccount();
    account.setOrg(org);
    account.setCode(code != null ? code.trim() : "");
    account.setName(name != null ? name.trim() : "");
    account.setAccountType(accountType);
    account.setActive(true);
    account.setCreatedAt(Instant.now(clock));
    return ledgerAccountRepository.save(account);
  }

  @Override
  @Transactional(readOnly = true)
  public LedgerAccount require(UUID orgId, UUID accountId) {
    return ledgerAccountRepository
        .findByIdAndOrgId(accountId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "LEDGER_ACCOUNT_NOT_FOUND", "Ledger account not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public LedgerAccount requireByCode(UUID orgId, String code) {
    return ledgerAccountRepository
        .findByOrgIdAndCode(orgId, code != null ? code.trim() : "")
        .orElseThrow(
            () ->
                new NotFoundException(
                    "LEDGER_ACCOUNT_NOT_FOUND", "Ledger account not found for code: " + code));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<LedgerAccount> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return ledgerAccountRepository.findAllByOrgId(orgId, pageable);
  }
}
