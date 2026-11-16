package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.DeviceRegistration;
import com.blinc.xpos.modules.organization.repository.DeviceRegistrationRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.DeviceRegistrationService;
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
public class DeviceRegistrationServiceImpl implements DeviceRegistrationService {

  private final DeviceRegistrationRepository deviceRegistrationRepository;
  private final BranchService branchService;
  private final Clock clock;

  public DeviceRegistrationServiceImpl(
      DeviceRegistrationRepository deviceRegistrationRepository,
      BranchService branchService,
      Clock clock) {
    this.deviceRegistrationRepository =
        Objects.requireNonNull(deviceRegistrationRepository, "deviceRegistrationRepository");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public DeviceRegistration register(
      UUID orgId, UUID branchId, String deviceId, String deviceFingerprint) {
    Branch branch = branchService.require(orgId, branchId);

    deviceRegistrationRepository
        .findByOrgIdAndDeviceId(orgId, deviceId)
        .ifPresent(
            existing -> {
              throw new ConflictException(
                  "DEVICE_ALREADY_REGISTERED",
                  "This device is already registered in this organization");
            });

    DeviceRegistration device = new DeviceRegistration();
    device.setOrg(branch.getOrg());
    device.setBranch(branch);
    device.setDeviceId(deviceId);
    device.setDeviceFingerprint(deviceFingerprint);

    Instant now = Instant.now(clock);
    device.setLastSeenAt(now);
    device.setCreatedAt(now);
    device.setUpdatedAt(now);

    // Important control: new devices start INACTIVE until explicitly approved by an admin.
    device.setStatus(StatusCommon.INACTIVE);

    return deviceRegistrationRepository.save(device);
  }

  @Override
  @Transactional(readOnly = true)
  public DeviceRegistration require(UUID orgId, UUID deviceRegistrationId) {
    return deviceRegistrationRepository
        .findByIdAndOrgId(deviceRegistrationId, orgId)
        .orElseThrow(
            () -> new NotFoundException("DEVICE_NOT_FOUND", "Device registration not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public DeviceRegistration requireByDeviceId(UUID orgId, String deviceId) {
    return deviceRegistrationRepository
        .findByOrgIdAndDeviceId(orgId, deviceId)
        .orElseThrow(
            () -> new NotFoundException("DEVICE_NOT_FOUND", "Device registration not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<DeviceRegistration> list(UUID orgId, Pageable pageable) {
    return deviceRegistrationRepository.findAllByOrgIdAndStatusIn(
        orgId, List.of(StatusCommon.ACTIVE, StatusCommon.INACTIVE), pageable);
  }

  @Override
  @Transactional
  public DeviceRegistration activate(UUID orgId, UUID deviceRegistrationId) {
    DeviceRegistration device = require(orgId, deviceRegistrationId);
    device.setStatus(StatusCommon.ACTIVE);
    device.setUpdatedAt(Instant.now(clock));
    return deviceRegistrationRepository.save(device);
  }

  @Override
  @Transactional
  public void softDelete(UUID orgId, UUID deviceRegistrationId) {
    DeviceRegistration device = require(orgId, deviceRegistrationId);
    device.setStatus(StatusCommon.DELETED);
    device.setUpdatedAt(Instant.now(clock));
    deviceRegistrationRepository.save(device);
  }

  @Override
  @Transactional
  public DeviceRegistration deactivate(UUID orgId, UUID deviceRegistrationId) {
    DeviceRegistration device = require(orgId, deviceRegistrationId);
    device.setStatus(StatusCommon.INACTIVE);
    device.setUpdatedAt(Instant.now(clock));
    return deviceRegistrationRepository.save(device);
  }

  @Override
  @Transactional
  public DeviceRegistration heartbeat(UUID orgId, String deviceId, String deviceFingerprint) {
    DeviceRegistration device = requireByDeviceId(orgId, deviceId);
    if (device.getDeviceFingerprint() != null
        && deviceFingerprint != null
        && !device.getDeviceFingerprint().equals(deviceFingerprint)) {
      throw new ConflictException(
          "DEVICE_FINGERPRINT_MISMATCH", "Device fingerprint does not match the registered device");
    }
    if (device.getDeviceFingerprint() == null) {
      device.setDeviceFingerprint(deviceFingerprint);
    }
    Instant now = Instant.now(clock);
    device.setLastSeenAt(now);
    device.setUpdatedAt(now);
    return deviceRegistrationRepository.save(device);
  }
}
