package com.blinc.xpos.modules.inventory.dto;

/** Per-line outcome when previewing or recording sales from a Standard Stock Count Sheet. */
public enum StdStockCountSalesLineStatus {
  RECORDED,
  SKIPPED_NO_QTY,
  SKIPPED_NO_CLOSING,
  SKIPPED_NO_IMPLIED_SALE,
  WARNING_OVER_RECORDED
}
