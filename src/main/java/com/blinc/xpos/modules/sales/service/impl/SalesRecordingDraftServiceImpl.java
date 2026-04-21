package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.api.v1.operator.dto.SalesRecordingDraftResponse;
import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import com.blinc.xpos.modules.sales.domain.SalesRecordingDraft;
import com.blinc.xpos.modules.sales.repository.SalesRecordingDraftRepository;
import com.blinc.xpos.modules.sales.service.SalesRecordingDraftService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SalesRecordingDraftServiceImpl implements SalesRecordingDraftService {

  private static final int BACKDATE_MAX_DAYS = 7;
  private static final int MAX_ENTRIES = 2_000;
  private static final int MAX_QTY_STRING_LENGTH = 32;

  private static final TypeReference<LinkedHashMap<String, String>> MAP_TYPE =
      new TypeReference<>() {};

  private final SalesRecordingDraftRepository draftRepository;
  private final BranchService branchService;
  private final TerminalService terminalService;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public SalesRecordingDraftServiceImpl(
      SalesRecordingDraftRepository draftRepository,
      BranchService branchService,
      TerminalService terminalService,
      ObjectMapper objectMapper,
      Clock clock) {
    this.draftRepository = Objects.requireNonNull(draftRepository, "draftRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional(readOnly = true)
  public SalesRecordingDraftResponse loadDraft(
      UUID orgId, UUID branchId, UUID terminalId, String iamUserId, LocalDate saleDate) {
    requireIamUserId(iamUserId);
    validateDate(saleDate);
    requireOrgScope(orgId, branchId, terminalId);
    Optional<SalesRecordingDraft> existing =
        draftRepository.findDraft(orgId, branchId, terminalId, iamUserId, saleDate);
    if (existing.isEmpty()) {
      return new SalesRecordingDraftResponse(false, saleDate, Collections.emptyMap(), null);
    }
    SalesRecordingDraft draft = existing.get();
    return new SalesRecordingDraftResponse(
        true, saleDate, deserializeQtyMap(draft.getDraftJson()), draft.getUpdatedAt());
  }

  @Override
  @Transactional
  public SalesRecordingDraftResponse saveDraft(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      String iamUserId,
      LocalDate saleDate,
      Map<UUID, String> qtyByItem) {
    requireIamUserId(iamUserId);
    validateDate(saleDate);
    requireOrgScope(orgId, branchId, terminalId);
    Map<UUID, String> clean = validateAndClean(qtyByItem);

    Optional<SalesRecordingDraft> existing =
        draftRepository.findDraft(orgId, branchId, terminalId, iamUserId, saleDate);

    if (clean.isEmpty()) {
      existing.ifPresent(draftRepository::delete);
      return new SalesRecordingDraftResponse(false, saleDate, Collections.emptyMap(), null);
    }

    Instant now = Instant.now(clock);
    SalesRecordingDraft draft = existing.orElseGet(SalesRecordingDraft::new);
    if (draft.getId() == null) {
      Branch branch = branchService.require(orgId, branchId);
      Terminal terminal = terminalService.require(orgId, terminalId);
      if (!terminal.getBranch().getId().equals(branchId)) {
        throw new NotFoundException("TERMINAL_NOT_FOUND", "Terminal not found in this branch");
      }
      draft.setOrg(branch.getOrg());
      draft.setBranch(branch);
      draft.setTerminal(terminal);
      draft.setIamUserId(iamUserId);
      draft.setSaleDate(saleDate);
    }
    draft.setDraftJson(serializeQtyMap(clean));
    draft.setUpdatedAt(now);
    SalesRecordingDraft saved = draftRepository.save(draft);
    return new SalesRecordingDraftResponse(true, saleDate, clean, saved.getUpdatedAt());
  }

  @Override
  @Transactional
  public void deleteDraft(
      UUID orgId, UUID branchId, UUID terminalId, String iamUserId, LocalDate saleDate) {
    requireIamUserId(iamUserId);
    if (saleDate == null) {
      throw new BadRequestException("SALE_DATE_REQUIRED", "Sale date is required.");
    }
    draftRepository.deleteDraft(orgId, branchId, terminalId, iamUserId, saleDate);
  }

  private void requireOrgScope(UUID orgId, UUID branchId, UUID terminalId) {
    branchService.require(orgId, branchId);
    Terminal terminal = terminalService.require(orgId, terminalId);
    if (!terminal.getBranch().getId().equals(branchId)) {
      throw new NotFoundException("TERMINAL_NOT_FOUND", "Terminal not found in this branch");
    }
  }

  private void requireIamUserId(String iamUserId) {
    if (iamUserId == null || iamUserId.isBlank()) {
      throw new BadRequestException(
          "IAM_USER_REQUIRED", "Authenticated user id is required for drafts.");
    }
  }

  private void validateDate(LocalDate saleDate) {
    if (saleDate == null) {
      throw new BadRequestException("SALE_DATE_REQUIRED", "Sale date is required.");
    }
    LocalDate today = LocalDate.now(clock);
    LocalDate earliest = today.minusDays(BACKDATE_MAX_DAYS);
    if (saleDate.isAfter(today)) {
      throw new BadRequestException("SALE_DATE_FUTURE", "Sale date cannot be in the future.");
    }
    if (saleDate.isBefore(earliest)) {
      throw new BadRequestException(
          "SALE_DATE_TOO_OLD", "Sale date cannot be earlier than " + earliest + " (7 days ago).");
    }
  }

  private Map<UUID, String> validateAndClean(Map<UUID, String> qtyByItem) {
    if (qtyByItem == null) {
      throw new BadRequestException("QTY_BY_ITEM_REQUIRED", "qtyByItem is required.");
    }
    if (qtyByItem.size() > MAX_ENTRIES) {
      throw new BadRequestException(
          "DRAFT_TOO_LARGE", "Draft may not contain more than " + MAX_ENTRIES + " items.");
    }
    Map<UUID, String> clean = new LinkedHashMap<>();
    for (Map.Entry<UUID, String> e : qtyByItem.entrySet()) {
      if (e.getKey() == null) {
        throw new BadRequestException("ITEM_ID_REQUIRED", "Draft entry is missing item id.");
      }
      String raw = e.getValue();
      if (raw == null) {
        continue;
      }
      String trimmed = raw.trim();
      if (trimmed.isEmpty()) {
        continue;
      }
      if (trimmed.length() > MAX_QTY_STRING_LENGTH) {
        throw new BadRequestException(
            "QTY_TOO_LONG", "Quantity value is too long for item " + e.getKey() + ".");
      }
      clean.put(e.getKey(), trimmed);
    }
    return clean;
  }

  private String serializeQtyMap(Map<UUID, String> qtyByItem) {
    LinkedHashMap<String, String> stringKeyed = new LinkedHashMap<>(qtyByItem.size());
    qtyByItem.forEach((k, v) -> stringKeyed.put(k.toString(), v));
    try {
      return objectMapper.writeValueAsString(stringKeyed);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Failed to serialize draft payload", ex);
    }
  }

  private Map<UUID, String> deserializeQtyMap(String json) {
    if (json == null || json.isBlank()) {
      return Collections.emptyMap();
    }
    Map<String, String> raw;
    try {
      raw = objectMapper.readValue(json, MAP_TYPE);
    } catch (JsonProcessingException ex) {
      return Collections.emptyMap();
    }
    Map<UUID, String> parsed = new LinkedHashMap<>(raw.size());
    for (Map.Entry<String, String> e : raw.entrySet()) {
      try {
        parsed.put(UUID.fromString(e.getKey()), e.getValue());
      } catch (IllegalArgumentException ignored) {
        // Skip malformed keys rather than fail the whole load.
      }
    }
    return parsed;
  }
}
