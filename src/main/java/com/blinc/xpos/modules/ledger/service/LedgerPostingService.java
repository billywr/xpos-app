package com.blinc.xpos.modules.ledger.service;

import com.blinc.xpos.modules.cash.domain.CashMovement;
import com.blinc.xpos.modules.sales.domain.Sale;
import java.util.UUID;

/**
 * Posts double-entry ledger entries for business events (sale complete, cash movement) using
 * org-specific posting rules. If no active posting rule exists for the event type, no entries are
 * created.
 */
public interface LedgerPostingService {

  /**
   * Posts ledger entries for a completed sale. Looks up the active posting rule for event type
   * SALE_COMPLETE and creates debit/credit entries for the sale total. No-op if no rule is
   * configured.
   */
  void postSaleComplete(UUID orgId, Sale sale);

  /**
   * Posts ledger entries for a cash movement. Looks up the active posting rule for the movement
   * type (e.g. CASH_PAID_IN, CASH_PAID_OUT) and creates debit/credit entries. No-op if no rule is
   * configured.
   */
  void postCashMovement(UUID orgId, CashMovement movement);
}
