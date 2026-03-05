package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.dto.StdStockCountSaveRequest;
import com.blinc.xpos.modules.inventory.dto.StdStockCountSheetDto;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Standard Stock Count Sheet: bar-style sheet where Opening + Added = Total Stock,
 * Units Sold = Total - Closing, Amount = Units Sold × Selling Price.
 */
public interface StdStockCountService {

  StdStockCountSheetDto getSheet(UUID orgId, UUID branchId, LocalDate businessDate);

  StdStockCountSheetDto saveCounts(
      UUID orgId, UUID branchId, UUID staffUserId, StdStockCountSaveRequest request);
}
