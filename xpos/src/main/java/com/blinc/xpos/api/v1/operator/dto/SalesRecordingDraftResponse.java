package com.blinc.xpos.api.v1.operator.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Response for the Sales Recording draft endpoints. Returns the full draft state so the client can
 * hydrate the page. {@code exists} is {@code false} when the caller has no draft for the given
 * (terminal, saleDate) — in that case {@code qtyByItem} is empty and {@code updatedAt} is {@code
 * null}.
 */
public record SalesRecordingDraftResponse(
    boolean exists, LocalDate saleDate, Map<UUID, String> qtyByItem, Instant updatedAt) {}
