package com.blinc.xpos.modules.ledger.service;

import com.blinc.xpos.common.constants.enums.LedgerAccountType;
import com.blinc.xpos.modules.ledger.domain.LedgerAccount;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface LedgerAccountService {

  LedgerAccount create(UUID orgId, String code, String name, LedgerAccountType accountType);

  LedgerAccount require(UUID orgId, UUID accountId);

  LedgerAccount requireByCode(UUID orgId, String code);

  Page<LedgerAccount> list(UUID orgId, Pageable pageable);
}
