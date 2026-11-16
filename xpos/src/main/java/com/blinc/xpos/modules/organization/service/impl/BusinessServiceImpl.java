package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.ConflictException;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Business;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.repository.BusinessRepository;
import com.blinc.xpos.modules.organization.service.BusinessService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessServiceImpl implements BusinessService {

  private final BusinessRepository businessRepository;
  private final OrgService orgService;
  private final Clock clock;

  public BusinessServiceImpl(
      BusinessRepository businessRepository, OrgService orgService, Clock clock) {
    this.businessRepository = Objects.requireNonNull(businessRepository, "businessRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Business create(
      UUID orgId, String legalName, String kraPin, String logoUrl, String receiptFooter) {
    if (kraPin != null && !kraPin.isBlank() && businessRepository.existsByKraPin(kraPin)) {
      throw new ConflictException(
          "KRA_PIN_ALREADY_EXISTS",
          "A business with this KRA PIN already exists. KRA PIN must be unique.");
    }
    Org org = orgService.require(orgId);
    Business business = new Business();
    business.setOrg(org);
    business.setLegalName(legalName);
    business.setKraPin(kraPin);
    business.setLogoUrl(logoUrl);
    business.setReceiptFooter(receiptFooter);
    business.setStatus(StatusCommon.ACTIVE);
    Instant now = Instant.now(clock);
    business.setCreatedAt(now);
    business.setUpdatedAt(now);
    return businessRepository.save(business);
  }

  @Override
  @Transactional(readOnly = true)
  public Business require(UUID orgId, UUID businessId) {
    return businessRepository
        .findByIdAndOrgId(businessId, orgId)
        .orElseThrow(() -> new NotFoundException("BUSINESS_NOT_FOUND", "Business not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Business> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return businessRepository.findAllByOrgIdAndStatusIn(
        orgId, java.util.List.of(StatusCommon.ACTIVE, StatusCommon.INACTIVE), pageable);
  }

  @Override
  @Transactional
  public Business update(
      UUID orgId,
      UUID businessId,
      String legalName,
      String kraPin,
      String logoUrl,
      String receiptFooter,
      StatusCommon status) {
    Business business = require(orgId, businessId);
    if (kraPin != null
        && !kraPin.isBlank()
        && businessRepository.existsByKraPinAndIdNot(kraPin, businessId)) {
      throw new ConflictException(
          "KRA_PIN_ALREADY_EXISTS",
          "A business with this KRA PIN already exists. KRA PIN must be unique.");
    }
    business.setLegalName(legalName);
    business.setKraPin(kraPin);
    business.setLogoUrl(logoUrl);
    business.setReceiptFooter(receiptFooter);
    if (status != null) {
      business.setStatus(status);
    }
    business.setUpdatedAt(Instant.now(clock));
    return businessRepository.save(business);
  }

  @Override
  @Transactional
  public void softDelete(UUID orgId, UUID businessId) {
    Business business = require(orgId, businessId);
    business.setStatus(StatusCommon.DELETED);
    business.setUpdatedAt(Instant.now(clock));
    businessRepository.save(business);
  }
}
