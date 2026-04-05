package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.modules.sales.domain.Tender;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface TenderService {

  /**
   * Records a tender (payment) against a sale. Sale must be OPEN. Currency defaults to branch
   * currency if not provided.
   */
  Tender addTender(
      UUID orgId,
      UUID saleId,
      UUID tenderTypeId,
      BigDecimal amount,
      String currency,
      UUID staffUserId);

  List<Tender> listBySale(UUID orgId, UUID saleId);

  /** Removes a tender from an open sale. Sale must be OPEN and tender must belong to that sale. */
  void removeTender(UUID orgId, UUID saleId, UUID tenderId);
}
