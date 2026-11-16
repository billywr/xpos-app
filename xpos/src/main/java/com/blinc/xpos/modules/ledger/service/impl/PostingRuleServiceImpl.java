package com.blinc.xpos.modules.ledger.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.ledger.domain.PostingRule;
import com.blinc.xpos.modules.ledger.repository.PostingRuleRepository;
import com.blinc.xpos.modules.ledger.service.LedgerAccountService;
import com.blinc.xpos.modules.ledger.service.PostingRuleService;
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
public class PostingRuleServiceImpl implements PostingRuleService {

  private final PostingRuleRepository postingRuleRepository;
  private final LedgerAccountService ledgerAccountService;
  private final OrgService orgService;
  private final Clock clock;

  public PostingRuleServiceImpl(
      PostingRuleRepository postingRuleRepository,
      LedgerAccountService ledgerAccountService,
      OrgService orgService,
      Clock clock) {
    this.postingRuleRepository = Objects.requireNonNull(postingRuleRepository);
    this.ledgerAccountService = Objects.requireNonNull(ledgerAccountService);
    this.orgService = Objects.requireNonNull(orgService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public PostingRule create(
      UUID orgId, String eventType, String debitAccountCode, String creditAccountCode) {
    orgService.require(orgId);
    ledgerAccountService.requireByCode(orgId, debitAccountCode);
    ledgerAccountService.requireByCode(orgId, creditAccountCode);
    Instant now = Instant.now(clock);
    PostingRule rule = new PostingRule();
    rule.setOrg(orgService.require(orgId));
    rule.setEventType(eventType != null ? eventType.trim() : "");
    rule.setDebitAccountCode(debitAccountCode != null ? debitAccountCode.trim() : "");
    rule.setCreditAccountCode(creditAccountCode != null ? creditAccountCode.trim() : "");
    rule.setActive(true);
    rule.setCreatedAt(now);
    rule.setUpdatedAt(now);
    return postingRuleRepository.save(rule);
  }

  @Override
  @Transactional(readOnly = true)
  public PostingRule require(UUID orgId, UUID ruleId) {
    return postingRuleRepository
        .findByIdAndOrgId(ruleId, orgId)
        .orElseThrow(
            () -> new NotFoundException("POSTING_RULE_NOT_FOUND", "Posting rule not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<PostingRule> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return postingRuleRepository.findAllByOrgId(orgId, pageable);
  }
}
