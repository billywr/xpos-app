package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.domain.TenderType;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.repository.TenderRepository;
import com.blinc.xpos.modules.sales.repository.TenderTypeRepository;
import com.blinc.xpos.modules.sales.service.TenderService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenderServiceImpl implements TenderService {

  private static final String DEFAULT_CURRENCY = "KES";

  private final TenderRepository tenderRepository;
  private final SaleRepository saleRepository;
  private final TenderTypeRepository tenderTypeRepository;
  private final StaffUserService staffUserService;
  private final Clock clock;

  public TenderServiceImpl(
      TenderRepository tenderRepository,
      SaleRepository saleRepository,
      TenderTypeRepository tenderTypeRepository,
      StaffUserService staffUserService,
      Clock clock) {
    this.tenderRepository = Objects.requireNonNull(tenderRepository, "tenderRepository");
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.tenderTypeRepository =
        Objects.requireNonNull(tenderTypeRepository, "tenderTypeRepository");
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Tender addTender(
      UUID orgId,
      UUID saleId,
      UUID tenderTypeId,
      BigDecimal amount,
      String currency,
      UUID staffUserId) {
    Sale sale = requireOpenSale(orgId, saleId);
    TenderType tenderType =
        tenderTypeRepository
            .findByIdAndOrgId(tenderTypeId, orgId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "TENDER_TYPE_NOT_FOUND", "Tender type not found: " + tenderTypeId));
    if (!tenderType.getActive()) {
      throw new IllegalArgumentException("Tender type is not active");
    }
    StaffUser staffUser = staffUserService.require(orgId, staffUserId);
    String effectiveCurrency =
        currency != null && !currency.isBlank() ? currency.trim() : DEFAULT_CURRENCY;
    Tender tender = new Tender();
    tender.setOrg(sale.getOrg());
    tender.setSale(sale);
    tender.setTenderType(tenderType);
    tender.setAmount(amount);
    tender.setCurrency(effectiveCurrency);
    tender.setCapturedByStaffUser(staffUser);
    tender.setCapturedAt(Instant.now(clock));
    return tenderRepository.save(tender);
  }

  @Override
  @Transactional(readOnly = true)
  public List<Tender> listBySale(UUID orgId, UUID saleId) {
    Sale sale =
        saleRepository
            .findByIdAndOrgId(saleId, orgId)
            .orElseThrow(
                () -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));
    return tenderRepository.findBySaleIdOrderByCapturedAtWithTenderTypeAndStaff(sale.getId());
  }

  @Override
  @Transactional
  public void removeTender(UUID orgId, UUID saleId, UUID tenderId) {
    Sale sale = requireOpenSale(orgId, saleId);
    Tender tender =
        tenderRepository
            .findById(tenderId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "TENDER_NOT_FOUND", "Tender not found: " + tenderId));
    if (!tender.getSale().getId().equals(sale.getId())
        || !tender.getOrg().getId().equals(orgId)) {
      throw new NotFoundException(
          "TENDER_NOT_FOUND", "Tender not found for this sale: " + tenderId);
    }
    tenderRepository.delete(tender);
  }

  private Sale requireOpenSale(UUID orgId, UUID saleId) {
    Sale sale =
        saleRepository
            .findByIdAndOrgId(saleId, orgId)
            .orElseThrow(
                () -> new NotFoundException("SALE_NOT_FOUND", "Sale not found: " + saleId));
    if (sale.getStatus() != SaleStatus.OPEN) {
      throw new IllegalStateException(
          "Sale is not open. Only open sales can receive tenders.");
    }
    return sale;
  }
}
