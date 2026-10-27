package com.blinc.xpos.modules.reporting.service.impl;

import com.blinc.xpos.common.constants.enums.SaleStatus;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityApplyTiming;
import com.blinc.xpos.modules.cash.domain.RecurringUtilityExpense;
import com.blinc.xpos.modules.cash.dto.ExpenseCategorySum;
import com.blinc.xpos.modules.cash.repository.MiscExpenseRepository;
import com.blinc.xpos.modules.cash.repository.RecurringUtilityExpenseRepository;
import com.blinc.xpos.modules.debt.repository.CustomerDebtRepository;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.reporting.service.BiReportService;
import com.blinc.xpos.modules.sales.domain.Sale;
import com.blinc.xpos.modules.sales.repository.SaleRepository;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class BiReportServiceImpl implements BiReportService {

  private static final int SCALE = 2;
  private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  private final BranchService branchService;
  private final SaleRepository saleRepository;
  private final CustomerDebtRepository customerDebtRepository;
  private final MiscExpenseRepository miscExpenseRepository;
  private final RecurringUtilityExpenseRepository recurringUtilityRepository;

  public BiReportServiceImpl(
      BranchService branchService,
      SaleRepository saleRepository,
      CustomerDebtRepository customerDebtRepository,
      MiscExpenseRepository miscExpenseRepository,
      RecurringUtilityExpenseRepository recurringUtilityRepository) {
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.saleRepository = Objects.requireNonNull(saleRepository, "saleRepository");
    this.customerDebtRepository =
        Objects.requireNonNull(customerDebtRepository, "customerDebtRepository");
    this.miscExpenseRepository =
        Objects.requireNonNull(miscExpenseRepository, "miscExpenseRepository");
    this.recurringUtilityRepository =
        Objects.requireNonNull(recurringUtilityRepository, "recurringUtilityRepository");
  }

  @Override
  public void generateStakeholderReport(
      UUID orgId, UUID branchId, LocalDate fromDate, LocalDate toDate, OutputStream out) {
    Branch branch = branchService.require(orgId, branchId);
    ZoneId zone = toZoneId(branch.getTimezone());
    Instant start = fromDate.atStartOfDay(zone).toInstant();
    Instant end = toDate.plusDays(1).atStartOfDay(zone).toInstant();

    List<Sale> sales =
        saleRepository.findListByOrgIdAndBranchIdAndStatusAndCompletedAtBetween(
            orgId, branchId, SaleStatus.COMPLETED, start, end);

    BigDecimal revenue =
        sales.stream()
            .map(Sale::getTotal)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(SCALE, ROUNDING);

    List<String> openStatusNames = Arrays.asList("OPEN", "PARTIAL");
    BigDecimal totalOutstanding =
        customerDebtRepository.sumOutstandingByOrgIdAndBranchIdAndStatusIn(
            orgId, branchId, openStatusNames);
    BigDecimal overdue =
        customerDebtRepository.sumOverdueByOrgIdAndBranchIdAndStatusInAndDueDateBefore(
            orgId, branchId, openStatusNames, toDate);

    BigDecimal expenses =
        miscExpenseRepository.sumAmountByOrgIdAndBranchIdAndCreatedAtBetween(
            orgId, branchId, start, end);
    List<ExpenseCategorySum> byCategory =
        miscExpenseRepository.sumAmountByCategoryByOrgIdAndBranchIdAndCreatedAtBetween(
            orgId, branchId, start, end);

    List<RecurringUtilityExpense> utilities =
        recurringUtilityRepository.findAllActiveByOrgIdAndBranchId(orgId, branchId);
    BigDecimal utilitiesTotal = calculateUtilitiesTotal(utilities, fromDate, toDate);

    try {
      Document document = new Document();
      PdfWriter.getInstance(document, out);
      document.open();

      Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
      Font headingFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
      Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 10);

      document.add(new Paragraph("XPOS Business Intelligence Report", titleFont));
      document.add(new Paragraph(" "));
      document.add(
          new Paragraph(
              "Branch: " + (branch.getName() != null ? branch.getName() : branchId.toString()),
              normalFont));
      document.add(new Paragraph("Period: " + fromDate + " to " + toDate, normalFont));
      document.add(new Paragraph(" "));

      document.add(new Paragraph("Executive Summary", headingFont));
      document.add(
          buildSummaryTable(
              revenue,
              expenses,
              utilitiesTotal,
              totalOutstanding,
              overdue,
              sales.size(),
              normalFont));

      document.add(new Paragraph("Expenses by Category", headingFont));
      document.add(buildExpenseTable(byCategory, headingFont, normalFont));

      document.add(
          new Paragraph(
              "This report is intended for stakeholder decision-making. "
                  + "Generated by XPOS Analytics.",
              FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8)));
      document.close();
    } catch (DocumentException e) {
      throw new RuntimeException("Failed to generate BI report PDF", e);
    }
  }

  private static BigDecimal calculateUtilitiesTotal(
      List<RecurringUtilityExpense> utilities, LocalDate fromDate, LocalDate toDate) {
    if (utilities == null || utilities.isEmpty()) {
      return BigDecimal.ZERO;
    }
    BigDecimal total = BigDecimal.ZERO;
    YearMonth currentYm = YearMonth.from(fromDate);
    YearMonth endYm = YearMonth.from(toDate);
    while (!currentYm.isAfter(endYm)) {
      for (RecurringUtilityExpense util : utilities) {
        LocalDate applicationDate =
            util.getApplyTiming() == RecurringUtilityApplyTiming.END_OF_MONTH
                ? currentYm.atEndOfMonth()
                : currentYm.atDay(1);
        if (!applicationDate.isBefore(fromDate) && !applicationDate.isAfter(toDate)) {
          BigDecimal amt = util.getAmount() != null ? util.getAmount() : BigDecimal.ZERO;
          total = total.add(amt);
        }
      }
      currentYm = currentYm.plusMonths(1);
    }
    return total;
  }

  private static PdfPTable buildSummaryTable(
      BigDecimal revenue,
      BigDecimal expenses,
      BigDecimal utilitiesTotal,
      BigDecimal totalOutstanding,
      BigDecimal overdue,
      int transactionCount,
      Font normalFont) {
    PdfPTable summaryTable = new PdfPTable(2);
    summaryTable.setWidthPercentage(60);
    summaryTable.setSpacingBefore(5);
    summaryTable.setSpacingAfter(10);
    addCell(summaryTable, "Total Revenue", formatCurrency(revenue), normalFont);
    addCell(
        summaryTable,
        "Total Expenses",
        formatCurrency(expenses != null ? expenses : BigDecimal.ZERO),
        normalFont);
    addCell(summaryTable, "Monthly Utilities", formatCurrency(utilitiesTotal), normalFont);
    addCell(
        summaryTable,
        "Outstanding Debt",
        formatCurrency(totalOutstanding != null ? totalOutstanding : BigDecimal.ZERO),
        normalFont);
    addCell(
        summaryTable,
        "Overdue Debt",
        formatCurrency(overdue != null ? overdue : BigDecimal.ZERO),
        normalFont);
    addCell(summaryTable, "Transaction Count", String.valueOf(transactionCount), normalFont);
    return summaryTable;
  }

  private static void addCell(PdfPTable table, String label, String value, Font font) {
    PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
    labelCell.setBorderWidth(0.5f);
    table.addCell(labelCell);
    PdfPCell valueCell = new PdfPCell(new Phrase(value, font));
    valueCell.setBorderWidth(0.5f);
    valueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
    table.addCell(valueCell);
  }

  private static PdfPTable buildExpenseTable(
      List<ExpenseCategorySum> byCategory, Font headingFont, Font normalFont)
      throws DocumentException {
    PdfPTable expenseTable = new PdfPTable(2);
    expenseTable.setWidthPercentage(60);
    expenseTable.setSpacingBefore(5);
    expenseTable.setSpacingAfter(10);
    for (ExpenseCategorySum s : byCategory) {
      addCell(
          expenseTable,
          s.getCategory() != null ? s.getCategory() : "Other",
          formatCurrency(s.getAmount() != null ? s.getAmount() : BigDecimal.ZERO),
          normalFont);
    }
    if (byCategory.isEmpty()) {
      addCell(expenseTable, "No expenses recorded", "-", normalFont);
    }
    return expenseTable;
  }

  private static String formatCurrency(BigDecimal amount) {
    if (amount == null) {
      return "0.00 KES";
    }
    return amount.setScale(SCALE, ROUNDING) + " KES";
  }

  private static ZoneId toZoneId(String timezone) {
    if (timezone == null || timezone.isBlank()) {
      return ZoneOffset.UTC;
    }
    try {
      return ZoneId.of(timezone.trim());
    } catch (Exception e) {
      return ZoneOffset.UTC;
    }
  }
}
