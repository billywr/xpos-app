package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Upsert body for the Sales Recording draft. {@code qtyByItem} maps an item id to its in-progress
 * quantity as a string (the client may carry partial decimals like "0." while typing). Qty values
 * are stored verbatim so the draft can round-trip whatever the user typed.
 */
public record SalesRecordingDraftRequest(
    @NotNull LocalDate saleDate, @NotNull Map<UUID, String> qtyByItem) {}
