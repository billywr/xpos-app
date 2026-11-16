package com.blinc.xpos.modules.compliance.service.impl;

import com.blinc.xpos.common.constants.enums.EtimsStatus;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.compliance.domain.EtimsInvoiceRecord;
import com.blinc.xpos.modules.compliance.repository.EtimsInvoiceRecordRepository;
import com.blinc.xpos.modules.compliance.service.EtimsInvoiceRecordService;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.service.SaleService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EtimsInvoiceRecordServiceImpl implements EtimsInvoiceRecordService {

  private final EtimsInvoiceRecordRepository etimsInvoiceRecordRepository;
  private final OrgService orgService;
  private final BranchService branchService;
  private final SaleService saleService;
  private final Clock clock;

  public EtimsInvoiceRecordServiceImpl(
      EtimsInvoiceRecordRepository etimsInvoiceRecordRepository,
      OrgService orgService,
      BranchService branchService,
      SaleService saleService,
      Clock clock) {
    this.etimsInvoiceRecordRepository = Objects.requireNonNull(etimsInvoiceRecordRepository);
    this.orgService = Objects.requireNonNull(orgService);
    this.branchService = Objects.requireNonNull(branchService);
    this.saleService = Objects.requireNonNull(saleService);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  @Transactional
  public EtimsInvoiceRecord create(UUID orgId, UUID branchId, UUID saleId) {
    var branch = branchService.require(orgId, branchId);
    Sale sale =
        saleService
            .getByIdAndOrg(orgId, saleId)
            .orElseThrow(() -> new NotFoundException("SALE_NOT_FOUND", "Sale not found"));
    if (etimsInvoiceRecordRepository.findByOrgIdAndSaleId(orgId, saleId).isPresent()) {
      throw new IllegalArgumentException("eTIMS record already exists for this sale");
    }
    Instant now = Instant.now(clock);
    EtimsInvoiceRecord entity = new EtimsInvoiceRecord();
    entity.setOrg(branch.getOrg());
    entity.setBranch(branch);
    entity.setSale(sale);
    entity.setSubmissionStatus(EtimsStatus.PENDING);
    entity.setCreatedAt(now);
    entity.setUpdatedAt(now);
    return etimsInvoiceRecordRepository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public EtimsInvoiceRecord require(UUID orgId, UUID recordId) {
    return etimsInvoiceRecordRepository
        .findByIdAndOrgId(recordId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "ETIMS_INVOICE_RECORD_NOT_FOUND", "eTIMS invoice record not found"));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<EtimsInvoiceRecord> listByBranch(UUID orgId, UUID branchId, Pageable pageable) {
    branchService.require(orgId, branchId);
    return etimsInvoiceRecordRepository.findAllByOrgIdAndBranchId(orgId, branchId, pageable);
  }

  @Override
  @Transactional
  public EtimsInvoiceRecord submit(UUID orgId, UUID recordId) {
    EtimsInvoiceRecord entity = require(orgId, recordId);
    if (entity.getSubmissionStatus() != EtimsStatus.PENDING) {
      throw new IllegalStateException("Record is not in PENDING status");
    }
    entity.setSubmissionStatus(EtimsStatus.SENT);
    entity.setSubmittedAt(Instant.now(clock));
    entity.setUpdatedAt(Instant.now(clock));
    return etimsInvoiceRecordRepository.save(entity);
  }

  @Override
  @Transactional
  public EtimsInvoiceRecord pollStatus(UUID orgId, UUID recordId) {
    return require(orgId, recordId);
  }
}
