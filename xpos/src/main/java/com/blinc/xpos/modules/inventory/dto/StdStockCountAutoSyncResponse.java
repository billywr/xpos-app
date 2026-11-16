package com.blinc.xpos.modules.inventory.dto;

import java.time.LocalDate;

/** Result of background carry-forward auto-sync for a branch. */
public record StdStockCountAutoSyncResponse(LocalDate date, int rowsSynced) {}
