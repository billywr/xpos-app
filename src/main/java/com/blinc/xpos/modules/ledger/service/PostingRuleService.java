package com.blinc.xpos.modules.ledger.service;

import com.blinc.xpos.modules.ledger.domain.PostingRule;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PostingRuleService {

  PostingRule create(
      UUID orgId, String eventType, String debitAccountCode, String creditAccountCode);

  PostingRule require(UUID orgId, UUID ruleId);

  Page<PostingRule> list(UUID orgId, Pageable pageable);
}
