package com.blinc.xpos.modules.sales.service;

import com.blinc.xpos.api.v1.operator.dto.SalesRecordingDraftResponse;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Server-side persistence of the Sales Recording screen's in-progress draft. A draft is scoped to
 * the calling staff user (by {@code iamUserId}) at a specific terminal on a specific sale date, so
 * that refreshing the page, switching devices, or re-logging in all restore the same state.
 *
 * <p>Drafts are auto-deleted when the corresponding batch is successfully recorded via {@link
 * SalesRecordingService#recordBatch}.
 */
public interface SalesRecordingDraftService {

  /** Returns the draft for the given scope, or an empty response ({@code exists=false}). */
  SalesRecordingDraftResponse loadDraft(
      UUID orgId, UUID branchId, UUID terminalId, String iamUserId, LocalDate saleDate);

  /**
   * Upserts the draft. An empty {@code qtyByItem} deletes any existing draft — clients use this to
   * explicitly clear.
   */
  SalesRecordingDraftResponse saveDraft(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      String iamUserId,
      LocalDate saleDate,
      Map<UUID, String> qtyByItem);

  /** Deletes the draft if present; idempotent. */
  void deleteDraft(
      UUID orgId, UUID branchId, UUID terminalId, String iamUserId, LocalDate saleDate);
}
