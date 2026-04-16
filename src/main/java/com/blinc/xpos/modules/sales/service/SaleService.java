package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.SaleLine;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface SaleService {

  /**
   * Creates a new open sale for the terminal. Requires an open shift. Optionally associates a
   * customer. Selling prices are resolved from each item's defaultSellingPrice.
   */
  Sale create(UUID orgId, UUID branchId, UUID terminalId, UUID staffUserId, UUID customerId);

  Optional<Sale> getByIdAndOrg(UUID orgId, UUID saleId);

  List<Sale> listOpenOrHeld(UUID orgId, UUID branchId, UUID terminalId);

  /** Returns lines for a sale (org-scoped). */
  List<SaleLine> listLines(UUID orgId, UUID saleId);

  /**
   * Adds a line to an open sale. Unit price is resolved from the sale's price list when not
   * provided. Modifiers (option ids with qty) add to line total.
   */
  Sale addLine(
      UUID orgId,
      UUID saleId,
      UUID itemId,
      BigDecimal qty,
      UUID uomId,
      BigDecimal unitPriceOverride,
      List<ModifierQuantity> modifiers);

  /** Holds the sale (status HELD). */
  Sale hold(UUID orgId, UUID saleId);

  /**
   * Completes the sale: creates receipt, links to sale, sets status COMPLETED. Tender total must be
   * at least sale total.
   */
  Sale complete(UUID orgId, UUID saleId);

  /**
   * Completes the sale when tender total is less than sale total, allowing the remainder to be
   * recorded as debt. Used only when a debt has already been created for the remainder. Skips the
   * tender-total validation.
   */
  Sale completeAllowingPartialWithDebt(UUID orgId, UUID saleId);

  /** Voids the sale (status VOIDED). Only open or held sales can be voided. */
  Sale voidSale(UUID orgId, UUID saleId);

  /**
   * Refunds a completed sale: returns items to stock, cancels linked debts, sets status REFUNDED.
   * Only COMPLETED sales can be refunded.
   */
  Sale refundSale(UUID orgId, UUID saleId, UUID refundedByStaffUserId);

  /**
   * Lists sales by branch with status and completedAt date range (admin). For COMPLETED status,
   * filters by completedAt between start and end.
   */
  Page<Sale> listByBranch(
      UUID orgId, UUID branchId, SaleStatus status, Instant start, Instant end, Pageable pageable);

  /** Quantity for a modifier option when adding a line. */
  record ModifierQuantity(UUID modifierOptionId, BigDecimal qty) {}
}
