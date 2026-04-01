package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.dto.ManualStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.ManualStockCountSheetResponse;
import java.time.LocalDate;
import java.util.UUID;

public interface ManualStockCountService {

  ManualStockCountSheetResponse getSheet(UUID orgId, UUID branchId, LocalDate businessDate);

  ManualStockCountSheetResponse saveSheet(
      UUID orgId, UUID branchId, UUID staffUserId, ManualStockCountSaveRequest request);
}
