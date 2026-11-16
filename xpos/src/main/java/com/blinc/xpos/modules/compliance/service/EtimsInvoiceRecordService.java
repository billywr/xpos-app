package com.blinc.xpos.modules.compliance.service;

import com.blinc.xpos.modules.compliance.domain.EtimsInvoiceRecord;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface EtimsInvoiceRecordService {

  EtimsInvoiceRecord create(UUID orgId, UUID branchId, UUID saleId);

  EtimsInvoiceRecord require(UUID orgId, UUID recordId);

  Page<EtimsInvoiceRecord> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  /** Submits the invoice to eTIMS (stub: sets status SENT). Real integration later. */
  EtimsInvoiceRecord submit(UUID orgId, UUID recordId);

  /** Polls eTIMS status (stub: no-op or returns current status). Real integration later. */
  EtimsInvoiceRecord pollStatus(UUID orgId, UUID recordId);
}
