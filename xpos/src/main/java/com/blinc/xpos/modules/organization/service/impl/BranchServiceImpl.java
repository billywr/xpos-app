package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.compliance.domain.TaxAgencyConfig;
import com.blinc.xpos.modules.compliance.repository.TaxAgencyConfigRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Business;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.ReceiptTemplate;
import com.blinc.xpos.modules.organization.repository.BranchRepository;
import com.blinc.xpos.modules.organization.repository.ReceiptTemplateRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.BusinessService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BranchServiceImpl implements BranchService {

  private static final String DEFAULT_TIMEZONE = "Africa/Nairobi";
  private static final String DEFAULT_CURRENCY = "KES";

  private final BranchRepository branchRepository;
  private final TaxAgencyConfigRepository taxAgencyConfigRepository;
  private final ReceiptTemplateRepository receiptTemplateRepository;
  private final OrgService orgService;
  private final BusinessService businessService;
  private final Clock clock;

  public BranchServiceImpl(
      BranchRepository branchRepository,
      TaxAgencyConfigRepository taxAgencyConfigRepository,
      ReceiptTemplateRepository receiptTemplateRepository,
      OrgService orgService,
      BusinessService businessService,
      Clock clock) {
    this.branchRepository = Objects.requireNonNull(branchRepository, "branchRepository");
    this.taxAgencyConfigRepository =
        Objects.requireNonNull(taxAgencyConfigRepository, "taxAgencyConfigRepository");
    this.receiptTemplateRepository =
        Objects.requireNonNull(receiptTemplateRepository, "receiptTemplateRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.businessService = Objects.requireNonNull(businessService, "businessService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Branch create(
      UUID orgId,
      UUID businessId,
      String name,
      String timezone,
      String currency,
      JsonNode addressJson,
      UUID taxAgencyConfigId,
      UUID receiptTemplateId) {
    Org org = orgService.require(orgId);
    Business business = businessService.require(orgId, businessId);

    Branch branch = new Branch();
    branch.setOrg(org);
    branch.setBusiness(business);
    branch.setName(name);
    branch.setTimezone(normalizeOrDefault(timezone, DEFAULT_TIMEZONE));
    branch.setCurrency(normalizeOrDefault(currency, DEFAULT_CURRENCY));
    branch.setAddressJson(addressJson);
    branch.setTaxAgencyConfig(resolveTaxAgency(orgId, taxAgencyConfigId));
    branch.setReceiptTemplate(resolveReceiptTemplate(orgId, receiptTemplateId));
    branch.setStatus(StatusCommon.ACTIVE);
    Instant now = Instant.now(clock);
    branch.setCreatedAt(now);
    branch.setUpdatedAt(now);
    return branchRepository.save(branch);
  }

  @Override
  @Transactional(readOnly = true)
  public Branch require(UUID orgId, UUID branchId) {
    return branchRepository
        .findByIdAndOrgId(branchId, orgId)
        .orElseThrow(() -> new NotFoundException("BRANCH_NOT_FOUND", "Branch not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Branch> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return branchRepository.findAllByOrgIdAndStatusIn(
        orgId, java.util.List.of(StatusCommon.ACTIVE, StatusCommon.INACTIVE), pageable);
  }

  @Override
  @Transactional
  public Branch update(
      UUID orgId,
      UUID branchId,
      String name,
      String timezone,
      String currency,
      JsonNode addressJson,
      UUID taxAgencyConfigId,
      UUID receiptTemplateId,
      StatusCommon status) {
    Branch branch = require(orgId, branchId);
    branch.setName(name);
    if (timezone != null && !timezone.isBlank()) {
      branch.setTimezone(timezone.trim());
    }
    if (currency != null && !currency.isBlank()) {
      branch.setCurrency(currency.trim().toUpperCase(Locale.ROOT));
    }
    branch.setAddressJson(addressJson);
    branch.setTaxAgencyConfig(resolveTaxAgency(orgId, taxAgencyConfigId));
    branch.setReceiptTemplate(resolveReceiptTemplate(orgId, receiptTemplateId));
    if (status != null) {
      branch.setStatus(status);
    }
    branch.setUpdatedAt(Instant.now(clock));
    return branchRepository.save(branch);
  }

  private TaxAgencyConfig resolveTaxAgency(UUID orgId, UUID taxAgencyConfigId) {
    if (taxAgencyConfigId == null) {
      return null;
    }
    return taxAgencyConfigRepository
        .findByIdAndOrgId(taxAgencyConfigId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "TAX_CONFIG_NOT_FOUND", "Tax agency configuration not found"));
  }

  private ReceiptTemplate resolveReceiptTemplate(UUID orgId, UUID receiptTemplateId) {
    if (receiptTemplateId == null) {
      return null;
    }
    return receiptTemplateRepository
        .findByIdAndOrgId(receiptTemplateId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException("RECEIPT_TEMPLATE_NOT_FOUND", "Receipt template not found"));
  }

  @Override
  @Transactional
  public void softDelete(UUID orgId, UUID branchId) {
    Branch branch = require(orgId, branchId);
    branch.setStatus(StatusCommon.DELETED);
    branch.setUpdatedAt(Instant.now(clock));
    branchRepository.save(branch);
  }

  private static String normalizeOrDefault(String value, String defaultValue) {
    if (value == null || value.isBlank()) {
      return defaultValue;
    }
    return value.trim();
  }
}
