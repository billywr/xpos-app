package com.blinc.xpos.modules.cash.service.impl;

import com.blinc.xpos.modules.cash.domain.ReceiptSequence;
import com.blinc.xpos.modules.cash.repository.ReceiptSequenceRepository;
import com.blinc.xpos.modules.cash.service.ReceiptSequenceService;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceiptSequenceServiceImpl implements ReceiptSequenceService {

  private final ReceiptSequenceRepository receiptSequenceRepository;
  private final BranchService branchService;
  private final TerminalService terminalService;
  private final Clock clock;

  public ReceiptSequenceServiceImpl(
      ReceiptSequenceRepository receiptSequenceRepository,
      BranchService branchService,
      TerminalService terminalService,
      Clock clock) {
    this.receiptSequenceRepository =
        Objects.requireNonNull(receiptSequenceRepository, "receiptSequenceRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public long getNextNumber(UUID orgId, UUID branchId, UUID terminalId, LocalDate businessDate) {
    branchService.require(orgId, branchId);
    if (terminalId != null) {
      Terminal terminal = terminalService.require(orgId, terminalId);
      if (!terminal.getBranch().getId().equals(branchId)) {
        throw new IllegalArgumentException("Terminal does not belong to branch");
      }
    }
    var opt =
        receiptSequenceRepository.findByBranchIdAndTerminalIdAndBusinessDate(
            branchId, terminalId, businessDate);
    if (opt.isEmpty()) {
      var branch = branchService.require(orgId, branchId);
      ReceiptSequence newSeq = new ReceiptSequence();
      newSeq.setOrg(branch.getOrg());
      newSeq.setBranch(branch);
      newSeq.setTerminal(
          terminalId != null ? terminalService.require(orgId, terminalId) : null);
      newSeq.setBusinessDate(businessDate);
      newSeq.setNextNumber(2L);
      newSeq.setCreatedAt(Instant.now(clock));
      receiptSequenceRepository.save(newSeq);
      return 1L;
    }
    ReceiptSequence seq = opt.get();
    long next = seq.getNextNumber();
    seq.setNextNumber(next + 1);
    receiptSequenceRepository.save(seq);
    return next;
  }
}
