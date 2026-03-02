package com.blinc.xpos.modules.auditvault.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.auditvault.domain.AuditVaultRecord;
import com.blinc.xpos.modules.auditvault.repository.AuditVaultRecordRepository;
import com.blinc.xpos.modules.auditvault.service.AuditVaultRecordService;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditVaultRecordServiceImpl implements AuditVaultRecordService {

  private static final String SHA256 = "SHA-256";

  private final AuditVaultRecordRepository auditVaultRecordRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final TerminalService terminalService;
  private final Clock clock;

  public AuditVaultRecordServiceImpl(
      AuditVaultRecordRepository auditVaultRecordRepository,
      OrgService orgService,
      BranchService branchService,
      TerminalService terminalService,
      Clock clock) {
    this.auditVaultRecordRepository = Objects.requireNonNull(auditVaultRecordRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.branchService = Objects.requireNonNull(branchService);
    this.terminalService = Objects.requireNonNull(terminalService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public AuditVaultRecord append(
      UUID orgId,
      UUID branchId,
      UUID terminalId,
      String eventType,
      UUID eventId,
      String payloadHash) {
    var branch = branchService.require(orgId, branchId);
    Terminal terminal = terminalId != null ? terminalService.require(orgId, terminalId) : null;
    Pageable oneDesc =
        PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt"));
    String previousHash =
        auditVaultRecordRepository
            .findAllByOrgIdAndBranchId(orgId, branchId, oneDesc)
            .getContent()
            .stream()
            .findFirst()
            .map(AuditVaultRecord::getHash)
            .orElse(null);
    Instant now = Instant.now(clock);
    String payloadHashSafe = payloadHash != null ? payloadHash : "";
    String eventTypeSafe = eventType != null ? eventType : "";
    String eventIdStr = eventId != null ? eventId.toString() : "";
    String toHash =
        (previousHash != null ? previousHash : "")
            + "|"
            + payloadHashSafe
            + "|"
            + eventTypeSafe
            + "|"
            + eventIdStr
            + "|"
            + now.toString();
    String hash = sha256Hex(toHash);
    AuditVaultRecord record = new AuditVaultRecord();
    record.setOrg(branch.getOrg());
    record.setBranch(branch);
    record.setTerminal(terminal);
    record.setEventType(eventTypeSafe);
    record.setEventId(eventId != null ? eventId : UUID.randomUUID());
    record.setPayloadHash(payloadHashSafe);
    record.setPreviousHash(previousHash);
    record.setHash(hash);
    record.setCreatedAt(now);
    return auditVaultRecordRepository.save(record);
  }

  @Override
  @Transactional(readOnly = true)
  public AuditVaultRecord require(UUID orgId, UUID recordId) {
    return auditVaultRecordRepository
        .findByIdAndOrgId(recordId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "AUDIT_VAULT_RECORD_NOT_FOUND", "Audit vault record not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<AuditVaultRecord> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return auditVaultRecordRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<AuditVaultRecord> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return auditVaultRecordRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }

  private static String sha256Hex(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance(SHA256);
      byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }
}
