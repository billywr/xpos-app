package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Full receipt payload for display/print: header, amounts, lines, tax breakdown, tenders, change.
 */
public record ReceiptDetailResponse(
    UUID id,
    UUID orgId,
    UUID branchId,
    UUID terminalId,
    LocalDate businessDate,
    Long receiptNumber,
    Instant printedAt,
    Integer reprintCount,
    Instant createdAt,
    BigDecimal subtotal,
    BigDecimal taxTotal,
    BigDecimal discountTotal,
    BigDecimal serviceChargeTotal,
    BigDecimal total,
    BigDecimal amountTendered,
    BigDecimal changeDue,
    BigDecimal debtAmount,
    java.time.LocalDate debtDueDate,
    List<ReceiptDetailLineItem> lines,
    List<ReceiptDetailTaxLine> taxLines,
    List<ReceiptDetailTender> tenders) {

  public record ReceiptDetailLineItem(
      UUID id,
      UUID itemId,
      String itemName,
      BigDecimal qty,
      UUID uomId,
      BigDecimal unitPrice,
      BigDecimal lineSubtotal,
      BigDecimal lineTotal,
      List<SaleLineModifierResponse> modifiers) {}

  public record ReceiptDetailTaxLine(
      UUID id,
      UUID taxProfileId,
      String taxProfileName,
      BigDecimal taxRate,
      BigDecimal taxAmount) {}

  public record ReceiptDetailTender(
      UUID id,
      String tenderTypeCode,
      String tenderTypeName,
      BigDecimal amount,
      String currency) {}
}
