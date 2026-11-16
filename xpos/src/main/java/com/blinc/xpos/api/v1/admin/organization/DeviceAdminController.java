package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.DeviceHeartbeatRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.DeviceRegisterRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.DeviceResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.DeviceRegistration;
import com.blinc.xpos.modules.organization.service.DeviceRegistrationService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class DeviceAdminController {

  private final DeviceRegistrationService deviceRegistrationService;
  private final PageRequestFactory pageRequestFactory;

  public DeviceAdminController(
      DeviceRegistrationService deviceRegistrationService, PageRequestFactory pageRequestFactory) {
    this.deviceRegistrationService =
        Objects.requireNonNull(deviceRegistrationService, "deviceRegistrationService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping("/orgs/{orgId}/branches/{branchId}/devices/register")
  @ResponseStatus(HttpStatus.CREATED)
  public DeviceResponse register(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody DeviceRegisterRequest request) {
    DeviceRegistration device =
        deviceRegistrationService.register(
            orgId, branchId, request.deviceId(), request.deviceFingerprint());
    return toResponse(device);
  }

  @GetMapping("/orgs/{orgId}/devices")
  public Page<DeviceResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return deviceRegistrationService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/orgs/{orgId}/devices/{deviceRegistrationId}")
  public DeviceResponse get(@PathVariable UUID orgId, @PathVariable UUID deviceRegistrationId) {
    return toResponse(deviceRegistrationService.require(orgId, deviceRegistrationId));
  }

  @PostMapping("/orgs/{orgId}/devices/{deviceRegistrationId}/activate")
  public DeviceResponse activate(
      @PathVariable UUID orgId, @PathVariable UUID deviceRegistrationId) {
    return toResponse(deviceRegistrationService.activate(orgId, deviceRegistrationId));
  }

  @PostMapping("/orgs/{orgId}/devices/{deviceRegistrationId}/deactivate")
  public DeviceResponse deactivate(
      @PathVariable UUID orgId, @PathVariable UUID deviceRegistrationId) {
    return toResponse(deviceRegistrationService.deactivate(orgId, deviceRegistrationId));
  }

  @DeleteMapping("/orgs/{orgId}/devices/{deviceRegistrationId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID deviceRegistrationId) {
    deviceRegistrationService.softDelete(orgId, deviceRegistrationId);
  }

  @PostMapping("/orgs/{orgId}/devices/by-device-id/{deviceId}/heartbeat")
  public DeviceResponse heartbeat(
      @PathVariable UUID orgId,
      @PathVariable String deviceId,
      @Valid @RequestBody DeviceHeartbeatRequest request) {
    return toResponse(
        deviceRegistrationService.heartbeat(orgId, deviceId, request.deviceFingerprint()));
  }

  private DeviceResponse toResponse(DeviceRegistration device) {
    return new DeviceResponse(
        device.getId(),
        device.getOrg().getId(),
        device.getBranch().getId(),
        device.getDeviceId(),
        device.getDeviceFingerprint(),
        device.getStatus(),
        device.getLastSeenAt(),
        device.getCreatedAt(),
        device.getUpdatedAt());
  }
}
