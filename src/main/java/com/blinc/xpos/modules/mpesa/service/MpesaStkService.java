package com.blinc.xpos.modules.mpesa.service;

import com.blinc.xpos.modules.mpesa.dto.MpesaStkInitiateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaStkStatusResponse;
import java.util.UUID;

public interface MpesaStkService {

  MpesaStkStatusResponse initiateStk(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      UUID saleId,
      UUID staffUserId,
      MpesaStkInitiateRequest request);

  MpesaStkStatusResponse getStatus(UUID orgId, UUID branchId, UUID stkRequestId);
}
