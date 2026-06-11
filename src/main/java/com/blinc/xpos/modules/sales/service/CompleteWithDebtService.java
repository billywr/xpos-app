package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.api.v1.operator.dto.CompleteWithDebtRequest;
import com.blinc.xpos.modules.sales.domain.Sale;
import java.util.UUID;

public interface CompleteWithDebtService {

  Sale completeWithDebt(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID saleId,
      UUID staffUserId,
      CompleteWithDebtRequest request);
}
