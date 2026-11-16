package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.api.v1.operator.dto.ReceiptDetailResponse;
import com.blinc.xpos.modules.sales.domain.Receipt;
import com.blinc.xpos.modules.sales.domain.Sale;
import java.util.Optional;
import java.util.UUID;

public interface ReceiptService {

  /**
   * Creates a receipt for a completed sale: allocates next receipt number and persists the receipt.
   * Caller must link receipt to sale and set sale status.
   */
  Receipt createForSale(Sale sale);

  Optional<Receipt> getBySaleId(UUID orgId, UUID saleId);

  /**
   * Returns full receipt details for a sale (amounts, lines, tax breakdown, tenders). Empty if sale
   * has no receipt (e.g. not yet completed).
   */
  Optional<ReceiptDetailResponse> getDetailBySaleId(UUID orgId, UUID saleId);

  /** Records a reprint: increments reprintCount and sets printedAt. */
  void recordReprint(UUID orgId, UUID saleId);
}
