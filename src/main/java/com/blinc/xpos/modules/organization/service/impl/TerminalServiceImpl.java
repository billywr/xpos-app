package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.DeviceRegistration;
import com.blinc.xpos.modules.organization.domain.PrinterProfile;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.repository.PrinterProfileRepository;
import com.blinc.xpos.modules.organization.repository.TerminalRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.DeviceRegistrationService;
import com.blinc.xpos.modules.organization.service.TerminalService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TerminalServiceImpl implements TerminalService {

  private final TerminalRepository terminalRepository;
  private final PrinterProfileRepository printerProfileRepository;
  private final BranchService branchService;
  private final DeviceRegistrationService deviceRegistrationService;
  private final Clock clock;

  public TerminalServiceImpl(
      TerminalRepository terminalRepository,
      PrinterProfileRepository printerProfileRepository,
      BranchService branchService,
      DeviceRegistrationService deviceRegistrationService,
      Clock clock) {
    this.terminalRepository = Objects.requireNonNull(terminalRepository, "terminalRepository");
    this.printerProfileRepository =
        Objects.requireNonNull(printerProfileRepository, "printerProfileRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.deviceRegistrationService =
        Objects.requireNonNull(deviceRegistrationService, "deviceRegistrationService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Terminal create(UUID orgId, UUID branchId, String terminalCode, UUID printerProfileId) {
    Branch branch = branchService.require(orgId, branchId);

    Terminal terminal = new Terminal();
    terminal.setOrg(branch.getOrg());
    terminal.setBranch(branch);
    terminal.setTerminalCode(terminalCode);
    terminal.setPrinterProfile(resolvePrinter(orgId, printerProfileId));
    terminal.setStatus(StatusCommon.ACTIVE);
    Instant now = Instant.now(clock);
    terminal.setCreatedAt(now);
    terminal.setUpdatedAt(now);
    return terminalRepository.save(terminal);
  }

  @Override
  @Transactional(readOnly = true)
  public Terminal require(UUID orgId, UUID terminalId) {
    return terminalRepository
        .findByIdAndOrgId(terminalId, orgId)
        .orElseThrow(() -> new NotFoundException("TERMINAL_NOT_FOUND", "Terminal not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Terminal> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return terminalRepository.findAllByOrgIdAndBranchIdAndStatusIn(
        orgId, branchId, List.of(StatusCommon.ACTIVE, StatusCommon.INACTIVE), pageable);
  }

  @Override
  @Transactional
  public Terminal update(
      UUID orgId,
      UUID terminalId,
      String terminalCode,
      UUID deviceRegistrationId,
      UUID printerProfileId,
      StatusCommon status) {
    Terminal terminal = require(orgId, terminalId);
    terminal.setTerminalCode(terminalCode);

    if (deviceRegistrationId != null) {
      DeviceRegistration device = deviceRegistrationService.require(orgId, deviceRegistrationId);
      terminal.setDeviceRegistration(device);
    } else {
      terminal.setDeviceRegistration(null);
    }

    terminal.setPrinterProfile(resolvePrinter(orgId, printerProfileId));
    if (status != null) {
      terminal.setStatus(status);
    }
    terminal.setUpdatedAt(Instant.now(clock));
    return terminalRepository.save(terminal);
  }

  @Override
  @Transactional
  public Terminal bindDevice(UUID orgId, UUID terminalId, UUID deviceRegistrationId) {
    Terminal terminal = require(orgId, terminalId);
    DeviceRegistration device = deviceRegistrationService.require(orgId, deviceRegistrationId);
    terminal.setDeviceRegistration(device);
    terminal.setUpdatedAt(Instant.now(clock));
    return terminalRepository.save(terminal);
  }

  @Override
  @Transactional
  public void softDelete(UUID orgId, UUID branchId, UUID terminalId) {
    Terminal terminal = require(orgId, terminalId);
    if (!terminal.getBranch().getId().equals(branchId)) {
      throw new NotFoundException("TERMINAL_NOT_FOUND", "Terminal not found in this branch");
    }
    terminal.setStatus(StatusCommon.DELETED);
    terminal.setUpdatedAt(Instant.now(clock));
    terminalRepository.save(terminal);
  }

  private PrinterProfile resolvePrinter(UUID orgId, UUID printerProfileId) {
    if (printerProfileId == null) {
      return null;
    }
    return printerProfileRepository
        .findByIdAndOrgId(printerProfileId, orgId)
        .orElseThrow(
            () -> new NotFoundException("PRINTER_PROFILE_NOT_FOUND", "Printer profile not found"));
  }
}
