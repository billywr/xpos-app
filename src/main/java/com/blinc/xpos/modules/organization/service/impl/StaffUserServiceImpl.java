package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.repository.StaffUserRepository;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffUserServiceImpl implements StaffUserService {

  private final StaffUserRepository staffUserRepository;
  private final OrgService orgService;
  private final Clock clock;

  public StaffUserServiceImpl(
      StaffUserRepository staffUserRepository, OrgService orgService, Clock clock) {
    this.staffUserRepository = Objects.requireNonNull(staffUserRepository, "staffUserRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public StaffUser create(UUID orgId, String iamUserId, String username) {
    Org org = orgService.require(orgId);

    StaffUser existing =
        staffUserRepository.findByOrgIdAndIamUserId(orgId, iamUserId).orElse(null);
    if (existing != null) {
      if (existing.getStatus() == StatusCommon.DELETED) {
        existing.setStatus(StatusCommon.ACTIVE);
        existing.setUsername(username);
        existing.setUpdatedAt(Instant.now(clock));
        return staffUserRepository.save(existing);
      }
      throw new ConflictException(
          "STAFF_ALREADY_EXISTS",
          "A staff user with this IAM user id already exists in this organization.");
    }

    StaffUser staffUser = new StaffUser();
    staffUser.setOrg(org);
    staffUser.setIamUserId(iamUserId);
    staffUser.setUsername(username);
    staffUser.setStatus(StatusCommon.ACTIVE);

    Instant now = Instant.now(clock);
    staffUser.setCreatedAt(now);
    staffUser.setUpdatedAt(now);

    return staffUserRepository.save(staffUser);
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser require(UUID orgId, UUID staffUserId) {
    return staffUserRepository
        .findByIdAndOrgId(staffUserId, orgId)
        .orElseThrow(() -> new NotFoundException("STAFF_USER_NOT_FOUND", "Staff user not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public StaffUser requireByIamUserId(UUID orgId, String iamUserId) {
    return staffUserRepository
        .findByOrgIdAndIamUserId(orgId, iamUserId)
        .orElseThrow(() -> new NotFoundException("STAFF_USER_NOT_FOUND", "Staff user not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<StaffUser> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return staffUserRepository.findAllByOrgIdAndStatusIn(
        orgId, java.util.List.of(StatusCommon.ACTIVE, StatusCommon.INACTIVE), pageable);
  }

  @Override
  @Transactional
  public StaffUser updateStatus(UUID orgId, UUID staffUserId, StatusCommon status) {
    StaffUser staffUser = require(orgId, staffUserId);
    if (status != null) {
      staffUser.setStatus(status);
    }
    staffUser.setUpdatedAt(Instant.now(clock));
    return staffUserRepository.save(staffUser);
  }

  @Override
  @Transactional
  public void softDelete(UUID orgId, UUID staffUserId) {
    StaffUser staffUser = require(orgId, staffUserId);
    staffUser.setStatus(StatusCommon.DELETED);
    staffUser.setUpdatedAt(Instant.now(clock));
    staffUserRepository.save(staffUser);
  }
}
