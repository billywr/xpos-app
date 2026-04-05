package com.blinc.xpos.modules.ledger.service.impl;

import com.blinc.xpos.common.constants.enums.CashMovementType;
import com.blinc.xpos.common.constants.enums.DebitCredit;
import com.blinc.xpos.common.constants.enums.SourceType;
import com.blinc.xpos.modules.cash.domain.CashMovement;
import com.blinc.xpos.modules.ledger.domain.LedgerEntry;
import com.blinc.xpos.modules.ledger.domain.PostingRule;
import com.blinc.xpos.modules.ledger.repository.LedgerEntryRepository;
import com.blinc.xpos.modules.ledger.repository.PostingRuleRepository;
import com.blinc.xpos.modules.ledger.service.LedgerAccountService;
import com.blinc.xpos.modules.ledger.service.LedgerPostingService;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.sales.domain.Sale;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LedgerPostingServiceImpl implements LedgerPostingService {

  /** Event type for posting rule when a sale is completed. */
  public static final String EVENT_SALE_COMPLETE = "SALE_COMPLETE";

  /** Event type for cash paid in (till increase). */
  public static final String EVENT_CASH_PAID_IN = "CASH_PAID_IN";

  /** Event type for cash paid out (till decrease). */
  public static final String EVENT_CASH_PAID_OUT = "CASH_PAID_OUT";

  /** Event type for petty cash. */
  public static final String EVENT_CASH_PETTY_CASH = "CASH_PETTY_CASH";

  /** Event type for float add. */
  public static final String EVENT_CASH_FLOAT_ADD = "CASH_FLOAT_ADD";

  private static final String DEFAULT_CURRENCY = "KES";

  private final PostingRuleRepository postingRuleRepository;
  private final LedgerAccountService ledgerAccountService;
  private final LedgerEntryRepository ledgerEntryRepository;

  public LedgerPostingServiceImpl(
      PostingRuleRepository postingRuleRepository,
      LedgerAccountService ledgerAccountService,
      LedgerEntryRepository ledgerEntryRepository) {
    this.postingRuleRepository = Objects.requireNonNull(postingRuleRepository);
    this.ledgerAccountService = Objects.requireNonNull(ledgerAccountService);
    this.ledgerEntryRepository = Objects.requireNonNull(ledgerEntryRepository);
  }

  @Override
  @Transactional
  public void postSaleComplete(UUID orgId, Sale sale) {
    Objects.requireNonNull(orgId, "orgId");
    Objects.requireNonNull(sale, "sale");
    BigDecimal amount = sale.getTotal();
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
      return;
    }
    Instant when = sale.getCompletedAt() != null ? sale.getCompletedAt() : Instant.now();
    post(orgId, sale.getBranch(), EVENT_SALE_COMPLETE, SourceType.SALE, sale.getId(), amount, when);
  }

  @Override
  @Transactional
  public void postCashMovement(UUID orgId, CashMovement movement) {
    Objects.requireNonNull(orgId, "orgId");
    Objects.requireNonNull(movement, "movement");
    BigDecimal amount = movement.getAmount();
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
      return;
    }
    String eventType = eventTypeForCashMovement(movement.getType());
    if (eventType == null) {
      return;
    }
    post(
        orgId,
        movement.getBranch(),
        eventType,
        SourceType.CASH_MOVEMENT,
        movement.getId(),
        amount,
        movement.getCreatedAt());
  }

  /**
   * Looks up active posting rule for event type; if present, creates one debit and one credit
   * ledger entry. Uses branch timezone for business date and branch currency (or KES).
   */
  private void post(
      UUID orgId,
      Branch branch,
      String eventType,
      SourceType sourceType,
      UUID sourceId,
      BigDecimal amount,
      Instant when) {
    Optional<PostingRule> ruleOpt =
        postingRuleRepository.findActiveByOrgIdAndEventType(orgId, eventType);
    if (ruleOpt.isEmpty()) {
      return;
    }
    PostingRule rule = ruleOpt.get();
    LocalDate businessDate = when.atZone(ZoneId.of(branch.getTimezone())).toLocalDate();
    String currency =
        branch.getCurrency() != null && !branch.getCurrency().isBlank()
            ? branch.getCurrency()
            : DEFAULT_CURRENCY;

    var debitAccount = ledgerAccountService.requireByCode(orgId, rule.getDebitAccountCode());
    var creditAccount = ledgerAccountService.requireByCode(orgId, rule.getCreditAccountCode());

    LedgerEntry debit = new LedgerEntry();
    debit.setOrg(branch.getOrg());
    debit.setBranch(branch);
    debit.setBusinessDate(businessDate);
    debit.setSourceType(sourceType);
    debit.setSourceId(sourceId);
    debit.setAccount(debitAccount);
    debit.setDirection(DebitCredit.DEBIT);
    debit.setAmount(amount);
    debit.setCurrency(currency);
    debit.setCreatedAt(when);
    ledgerEntryRepository.save(debit);

    LedgerEntry credit = new LedgerEntry();
    credit.setOrg(branch.getOrg());
    credit.setBranch(branch);
    credit.setBusinessDate(businessDate);
    credit.setSourceType(sourceType);
    credit.setSourceId(sourceId);
    credit.setAccount(creditAccount);
    credit.setDirection(DebitCredit.CREDIT);
    credit.setAmount(amount);
    credit.setCurrency(currency);
    credit.setCreatedAt(when);
    ledgerEntryRepository.save(credit);
  }

  private static String eventTypeForCashMovement(CashMovementType type) {
    if (type == null) {
      return null;
    }
    if (type == CashMovementType.PAID_IN) {
      return EVENT_CASH_PAID_IN;
    } else if (type == CashMovementType.PAID_OUT) {
      return EVENT_CASH_PAID_OUT;
    } else if (type == CashMovementType.PETTY_CASH) {
      return EVENT_CASH_PETTY_CASH;
    } else {
      return EVENT_CASH_FLOAT_ADD;
    }
  }
}
