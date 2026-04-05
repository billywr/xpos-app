package com.blinc.xpos.modules.cash.service;

import java.time.LocalDate;
import java.util.UUID;

public interface ReceiptSequenceService {

  /**
   * Returns the next receipt number for the given branch, terminal and business date. Creates the
   * sequence if it does not exist. Thread-safe within a transaction.
   */
  long getNextNumber(UUID orgId, UUID branchId, UUID terminalId, LocalDate businessDate);
}
