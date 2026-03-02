package com.blinc.xpos.modules.reporting.service.impl;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.modules.reporting.dto.ZReportSummaryResponse;
import com.blinc.xpos.modules.reporting.service.ZReportService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.repository.TenderRepository;
import com.blinc.xpos.modules.organization.service.BranchService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ZReportServiceImpl implements ZReportService {

  private static final String CODE_CASH = "CASH";
  private static final String CODE_MPESA = "MPESA";
  private static final String CODE_CARD = "CARD";

  private final SaleRepository saleRepository;
  private final TenderRepository tenderRepository;
  private final BranchService branchService;

  public ZReportServiceImpl(
      SaleRepository saleRepository,
      TenderRepository tenderRepository,
      BranchService branchService) {
    this.saleRepository = Objects.requireNonNull(saleRepository);
    this.tenderRepository = Objects.requireNonNull(tenderRepository);
    this.branchService = Objects.requireNonNull(branchService);
  }

  @Override
  @Transactional(readOnly = true)
  public ZReportSummaryResponse getZReport(UUID orgId, UUID branchId, LocalDate businessDate) {
    branchService.require(orgId, branchId);
    java.time.Instant start = businessDate.atStartOfDay(ZoneOffset.UTC).toInstant();
    java.time.Instant end = businessDate.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    List<Sale> sales =
        saleRepository.findByBranchIdAndStatusAndCompletedAtBetween(
            branchId, SaleStatus.COMPLETED, start, end);
    if (sales.isEmpty()) {
      return new ZReportSummaryResponse(
          orgId,
          branchId,
          businessDate,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          0);
    }
    List<UUID> saleIds = sales.stream().map(Sale::getId).toList();
    List<Tender> tenders = tenderRepository.findBySaleIdIn(saleIds);
    BigDecimal salesTotal =
        sales.stream().map(Sale::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal taxTotal =
        sales.stream().map(Sale::getTaxTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal cashTotal = BigDecimal.ZERO;
    BigDecimal mpesaTotal = BigDecimal.ZERO;
    BigDecimal cardTotal = BigDecimal.ZERO;
    BigDecimal otherTotal = BigDecimal.ZERO;
    for (Tender t : tenders) {
      String code = t.getTenderType().getCode() == null ? "" : t.getTenderType().getCode();
      BigDecimal amt = t.getAmount();
      String upper = code.toUpperCase();
      if (CODE_CASH.equals(upper)) {
        cashTotal = cashTotal.add(amt);
      } else if (CODE_MPESA.equals(upper)) {
        mpesaTotal = mpesaTotal.add(amt);
      } else if (CODE_CARD.equals(upper)) {
        cardTotal = cardTotal.add(amt);
      } else {
        otherTotal = otherTotal.add(amt);
      }
    }
    BigDecimal tenderTotal = cashTotal.add(mpesaTotal).add(cardTotal).add(otherTotal);
    BigDecimal varianceTotal = tenderTotal.subtract(salesTotal);
    return new ZReportSummaryResponse(
        orgId,
        branchId,
        businessDate,
        salesTotal,
        taxTotal,
        cashTotal,
        mpesaTotal,
        cardTotal,
        otherTotal,
        varianceTotal,
        sales.size());
  }
}
