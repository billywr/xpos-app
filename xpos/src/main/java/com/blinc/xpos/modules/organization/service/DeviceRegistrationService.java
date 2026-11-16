package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.modules.organization.domain.DeviceRegistration;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface DeviceRegistrationService {

  DeviceRegistration register(UUID orgId, UUID branchId, String deviceId, String deviceFingerprint);

  DeviceRegistration require(UUID orgId, UUID deviceRegistrationId);

  DeviceRegistration requireByDeviceId(UUID orgId, String deviceId);

  Page<DeviceRegistration> list(UUID orgId, Pageable pageable);

  DeviceRegistration activate(UUID orgId, UUID deviceRegistrationId);

  DeviceRegistration deactivate(UUID orgId, UUID deviceRegistrationId);

  void softDelete(UUID orgId, UUID deviceRegistrationId);

  DeviceRegistration heartbeat(UUID orgId, String deviceId, String deviceFingerprint);
}
