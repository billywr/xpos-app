package com.blinc.xpos.modules.sales.service.impl;

import com.blinc.xpos.api.v1.operator.dto.ReceiptDetailResponse;
import com.blinc.xpos.api.v1.operator.dto.SaleLineModifierResponse;
import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.cash.service.ReceiptSequenceService;
import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import com.blinc.xpos.modules.debt.repository.CustomerDebtRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.sales.domain.Receipt;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.domain.SaleLine;
import com.blinc.xpos.modules.sales.domain.SaleLineModifier;
import com.blinc.xpos.modules.sales.domain.SaleTaxLine;
import com.blinc.xpos.modules.sales.domain.Tender;
import com.blinc.xpos.modules.sales.repository.ReceiptRepository;
import com.blinc.xpos.modules.sales.repository.SaleLineModifierRepository;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.blinc.xpos.modules.sales.repository.SaleTaxLineRepository;
import com.blinc.xpos.modules.sales.repository.TenderRepository;
import com.blinc.xpos.modules.sales.service.ReceiptService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceiptServiceImpl implements ReceiptService {

  private final ReceiptRepository receiptRepository;
  private final SaleRepository saleRepository;
  private final ReceiptSequenceService receiptSequenceService;
  private final SaleLineRepository saleLineRepository;
  private final TenderRepository tenderRepository;
  private final SaleTaxLineRepository saleTaxLineRepository;
  private final SaleLineModifierRepository saleLineModifierRepository;
  private final CustomerDebtRepository customerDebtRepository;
  private final Clock clock;

  public ReceiptServiceImpl(
      ReceiptRepository receiptRepository,
      SaleRepository saleRepository,
      ReceiptSequenceService receiptSequenceService,
      SaleLineRepository saleLineRepository,
      TenderRepository tenderRepository,
      SaleTaxLineRepository saleTaxLineRepository,
      SaleLineModifierRepository saleLineModifierRepository,
      CustomerDebtRepository customerDebtRepository,
      Clock clock) {
    this.receiptRepository = Objects.requireNonNull(receiptRepository, "receiptRepository");
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.receiptSequenceService =
        Objects.requireNonNull(receiptSequenceService, "receiptSequenceService");
    this.saleLineRepository = Objects.requireNonNull(saleLineRepository, "saleLineRepository");
    this.tenderRepository = Objects.requireNonNull(tenderRepository, "tenderRepository");
    this.saleTaxLineRepository =
        Objects.requireNonNull(saleTaxLineRepository, "saleTaxLineRepository");
    this.saleLineModifierRepository =
        Objects.requireNonNull(saleLineModifierRepository, "saleLineModifierRepository");
    this.customerDebtRepository =
        Objects.requireNonNull(customerDebtRepository, "customerDebtRepository");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Receipt createForSale(Sale sale) {
    Objects.requireNonNull(sale, "sale");
    Branch branch = sale.getBranch();
    UUID orgId = branch.getOrg().getId();
    UUID branchId = branch.getId();
    UUID terminalId = sale.getTerminal().getId();
    LocalDate businessDate =
        sale.getBusinessDate() != null
            ? sale.getBusinessDate()
            : Instant.now(clock).atZone(ZoneId.of(branch.getTimezone())).toLocalDate();
    long nextNumber =
        receiptSequenceService.getNextNumber(orgId, branchId, terminalId, businessDate);
    Receipt receipt = new Receipt();
    receipt.setOrg(sale.getOrg());
    receipt.setBranch(branch);
    receipt.setTerminal(sale.getTerminal());
    receipt.setBusinessDate(businessDate);
    receipt.setReceiptNumber(nextNumber);
    receipt.setReprintCount(0);
    receipt.setCreatedAt(Instant.now(clock));
    return receiptRepository.save(receipt);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Receipt> getBySaleId(UUID orgId, UUID saleId) {
    return saleRepository
        .findByIdAndOrgId(saleId, orgId)
        .flatMap(s -> Optional.ofNullable(s.getReceipt()))
        .map(
            r -> {
              r.getOrg().getId();
              r.getBranch().getId();
              r.getTerminal().getId();
              return r;
            });
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<ReceiptDetailResponse> getDetailBySaleId(UUID orgId, UUID saleId) {
    return saleRepository
        .findByIdAndOrgId(saleId, orgId)
        .flatMap(
            sale -> {
              Receipt receipt = sale.getReceipt();
              if (receipt == null) {
                return Optional.empty();
              }
              receipt.getOrg().getId();
              receipt.getBranch().getId();
              receipt.getTerminal().getId();
              List<ReceiptDetailResponse.ReceiptDetailLineItem> lineItems =
                  buildReceiptDetailLineItems(saleId);
              List<SaleTaxLine> taxLines =
                  saleTaxLineRepository.findBySaleIdOrderByCreatedAtWithTaxProfile(saleId);
              List<ReceiptDetailResponse.ReceiptDetailTaxLine> taxDetailLines =
                  taxLines.stream()
                      .map(
                          t ->
                              new ReceiptDetailResponse.ReceiptDetailTaxLine(
                                  t.getId(),
                                  t.getTaxProfile() != null ? t.getTaxProfile().getId() : null,
                                  t.getTaxProfile() != null ? t.getTaxProfile().getName() : null,
                                  t.getTaxRate(),
                                  t.getTaxAmount()))
                      .toList();
              List<Tender> tenders =
                  tenderRepository.findBySaleIdOrderByCapturedAtWithTenderTypeAndStaff(saleId);
              List<ReceiptDetailResponse.ReceiptDetailTender> tenderDetails =
                  tenders.stream()
                      .map(
                          t ->
                              new ReceiptDetailResponse.ReceiptDetailTender(
                                  t.getId(),
                                  t.getTenderType().getCode(),
                                  t.getTenderType().getName(),
                                  t.getAmount(),
                                  t.getCurrency()))
                      .toList();
              BigDecimal amountTendered =
                  tenders.stream().map(Tender::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
              BigDecimal changeDue =
                  amountTendered
                      .subtract(sale.getTotal())
                      .max(BigDecimal.ZERO)
                      .setScale(2, RoundingMode.HALF_UP);
              BigDecimal debtAmount = null;
              LocalDate debtDueDate = null;
              List<CustomerDebt> debts =
                  customerDebtRepository.findAllBySaleIdAndOrgId(saleId, orgId);
              if (!debts.isEmpty()) {
                CustomerDebt debt = debts.get(0);
                debtAmount = debt.getAmount() != null ? debt.getAmount() : BigDecimal.ZERO;
                debtDueDate = debt.getDueDate();
              }
              ReceiptDetailResponse detail =
                  new ReceiptDetailResponse(
                      receipt.getId(),
                      receipt.getOrg().getId(),
                      receipt.getBranch().getId(),
                      receipt.getTerminal().getId(),
                      receipt.getBusinessDate(),
                      receipt.getReceiptNumber(),
                      receipt.getPrintedAt(),
                      receipt.getReprintCount(),
                      receipt.getCreatedAt(),
                      sale.getSubtotal(),
                      sale.getTaxTotal(),
                      sale.getDiscountTotal(),
                      sale.getServiceChargeTotal(),
                      sale.getTotal(),
                      amountTendered,
                      changeDue,
                      debtAmount,
                      debtDueDate,
                      lineItems,
                      taxDetailLines,
                      tenderDetails);
              return Optional.of(detail);
            });
  }

  private List<ReceiptDetailResponse.ReceiptDetailLineItem> buildReceiptDetailLineItems(
      UUID saleId) {
    List<SaleLine> lines = saleLineRepository.findBySaleIdOrderByCreatedAtWithItemAndUom(saleId);
    List<ReceiptDetailResponse.ReceiptDetailLineItem> lineItems = new ArrayList<>();
    for (SaleLine line : lines) {
      List<SaleLineModifier> modifiers =
          saleLineModifierRepository.findBySaleLineIdOrderByCreatedAtWithModifierOption(
              line.getId());
      List<SaleLineModifierResponse> modResponses =
          modifiers.stream()
              .map(
                  m ->
                      new SaleLineModifierResponse(
                          m.getId(),
                          m.getModifierOption().getId(),
                          m.getModifierOption().getName(),
                          m.getQty(),
                          m.getPriceDelta()))
              .toList();
      lineItems.add(
          new ReceiptDetailResponse.ReceiptDetailLineItem(
              line.getId(),
              line.getItem().getId(),
              line.getItem().getName(),
              line.getQty(),
              line.getUom() != null ? line.getUom().getId() : null,
              line.getUnitPrice(),
              line.getLineSubtotal(),
              line.getLineTotal(),
              modResponses));
    }
    return lineItems;
  }

  @Override
  @Transactional
  public void recordReprint(UUID orgId, UUID saleId) {
    Receipt receipt =
        saleRepository
            .findByIdAndOrgId(saleId, orgId)
            .filter(s -> s.getReceipt() != null)
            .map(Sale::getReceipt)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "RECEIPT_NOT_FOUND", "Receipt not found for sale: " + saleId));
    receipt.setReprintCount(
        (receipt.getReprintCount() != null ? receipt.getReprintCount() : 0) + 1);
    receipt.setPrintedAt(Instant.now(clock));
    receiptRepository.save(receipt);
  }
}
