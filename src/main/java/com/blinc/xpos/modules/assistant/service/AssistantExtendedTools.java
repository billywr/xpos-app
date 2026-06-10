package com.blinc.xpos.modules.assistant.service;

import com.blinc.xpos.api.v1.operator.dto.AnalyticsSnapshotResponse;
import com.blinc.xpos.common.constants.enums.ShiftStatus;
import com.blinc.xpos.modules.assistant.AssistantIntent;
import com.blinc.xpos.modules.assistant.domain.AssistantQueryLog;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryContext;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryResponse;
import com.blinc.xpos.modules.assistant.repository.AssistantQueryLogRepository;
import com.blinc.xpos.modules.cash.domain.Shift;
import com.blinc.xpos.modules.cash.repository.ShiftRepository;
import com.blinc.xpos.modules.debt.domain.CustomerDebt;
import com.blinc.xpos.modules.debt.repository.CustomerDebtRepository;
import com.blinc.xpos.modules.inventory.domain.StockCountLine;
import com.blinc.xpos.modules.inventory.repository.StockCountLineRepository;
import com.blinc.xpos.modules.reporting.service.OperatorAnalyticsService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/** Extended deterministic assistant tools (Phase 1 platform). */
@Component
public class AssistantExtendedTools {

  private static final int LIMIT = 5;
  private static final Pattern UUID_PATTERN =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

  private static final List<String> DEFAULT_SUGGESTIONS =
      List.of(
          "Sales today", "Who am I?", "Popular drinks this week", "Low stock", "Outstanding debt");

  private final OperatorAnalyticsService analyticsService;
  private final ShiftRepository shiftRepository;
  private final CustomerDebtRepository customerDebtRepository;
  private final AssistantQueryLogRepository queryLogRepository;
  private final StockCountLineRepository stockCountLineRepository;

  public AssistantExtendedTools(
      OperatorAnalyticsService analyticsService,
      ShiftRepository shiftRepository,
      CustomerDebtRepository customerDebtRepository,
      AssistantQueryLogRepository queryLogRepository,
      StockCountLineRepository stockCountLineRepository) {
    this.analyticsService = Objects.requireNonNull(analyticsService, "analyticsService");
    this.shiftRepository = Objects.requireNonNull(shiftRepository, "shiftRepository");
    this.customerDebtRepository =
        Objects.requireNonNull(customerDebtRepository, "customerDebtRepository");
    this.queryLogRepository = Objects.requireNonNull(queryLogRepository, "queryLogRepository");
    this.stockCountLineRepository =
        Objects.requireNonNull(stockCountLineRepository, "stockCountLineRepository");
  }

  public AssistantQueryResponse paymentMix(UUID orgId, UUID branchId) {
    AnalyticsSnapshotResponse snap = analyticsService.getSnapshot(orgId, branchId, null, null);
    List<AnalyticsSnapshotResponse.PaymentBreakdown> rows = snap.paymentBreakdown();
    if (rows == null || rows.isEmpty()) {
      return simple(
          "No payment breakdown for today yet.", AssistantIntent.PAYMENT_MIX.name(), Map.of());
    }
    StringBuilder answer = new StringBuilder("Payment mix today:");
    List<Map<String, Object>> list = new ArrayList<>();
    for (AnalyticsSnapshotResponse.PaymentBreakdown row : rows) {
      answer.append("\n• ").append(row.name()).append(": ").append(formatMoney(row.amount()));
      list.add(Map.of("code", row.code(), "name", row.name(), "amount", row.amount()));
    }
    return simple(answer.toString(), AssistantIntent.PAYMENT_MIX.name(), Map.of("payments", list));
  }

  public AssistantQueryResponse comparePeriods(UUID orgId, UUID branchId) {
    AnalyticsSnapshotResponse snap = analyticsService.getSnapshot(orgId, branchId, null, null);
    AnalyticsSnapshotResponse.Comparison cmp = snap.comparison();
    AnalyticsSnapshotResponse.Summary s = snap.summary();
    String answer =
        String.format(
            Locale.ROOT,
            "Today: %s revenue (%d sales). Previous period: %s (%s%% change).",
            formatMoney(s.todayRevenue()),
            s.todaySaleCount(),
            formatMoney(cmp.previousPeriodRevenue()),
            cmp.percentChange() != null ? cmp.percentChange().toPlainString() : "0");
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("revenue", s.todayRevenue());
    data.put("previousRevenue", cmp.previousPeriodRevenue());
    data.put("percentChange", cmp.percentChange());
    return simple(answer.toString(), AssistantIntent.COMPARE_PERIODS.name(), data);
  }

  public AssistantQueryResponse shiftVariance(UUID orgId, UUID branchId) {
    List<Shift> shifts =
        shiftRepository.findRecentClosedWithVariance(orgId, branchId, PageRequest.of(0, LIMIT));
    if (shifts.isEmpty()) {
      boolean open = shiftRepository.existsByBranchIdAndStatus(branchId, ShiftStatus.OPEN);
      if (open) {
        return simple(
            "Shift is still open — variance is recorded at close.",
            AssistantIntent.SHIFT_VARIANCE.name(),
            Map.of("hasOpenShift", true));
      }
      return simple(
          "No recent closed shifts with cash variance at this branch.",
          AssistantIntent.SHIFT_VARIANCE.name(),
          Map.of());
    }
    StringBuilder answer = new StringBuilder("Recent shift cash variances:");
    List<Map<String, Object>> list = new ArrayList<>();
    for (Shift shift : shifts) {
      answer
          .append("\n• ")
          .append(shift.getTerminal().getTerminalCode())
          .append(" — variance ")
          .append(formatMoney(shift.getVarianceAmount()));
      list.add(
          Map.of(
              "shiftId", shift.getId().toString(),
              "varianceAmount", shift.getVarianceAmount(),
              "terminalCode", shift.getTerminal().getTerminalCode()));
    }
    return simple(answer.toString(), AssistantIntent.SHIFT_VARIANCE.name(), Map.of("shifts", list));
  }

  public AssistantQueryResponse overdueDebts(UUID orgId, UUID branchId) {
    ZoneId zone = ZoneId.of(analyticsService.getSnapshot(orgId, branchId, null, null).timezone());
    LocalDate today = LocalDate.now(zone);
    List<CustomerDebt> rows =
        customerDebtRepository.findOverdueByOrgAndBranch(
            orgId, branchId, today, PageRequest.of(0, LIMIT));
    if (rows.isEmpty()) {
      return simple(
          "No overdue customer debts at this branch.",
          AssistantIntent.OVERDUE_DEBTS.name(),
          Map.of());
    }
    StringBuilder answer = new StringBuilder("Overdue customer debts:");
    List<Map<String, Object>> list = new ArrayList<>();
    for (CustomerDebt debt : rows) {
      BigDecimal outstanding = debt.getAmount().subtract(debt.getAmountSettled());
      answer
          .append("\n• ")
          .append(debt.getCustomer().getName())
          .append(" — ")
          .append(formatMoney(outstanding))
          .append(" (due ")
          .append(debt.getDueDate())
          .append(")");
      list.add(
          Map.of(
              "customerName", debt.getCustomer().getName(),
              "outstanding", outstanding,
              "dueDate", debt.getDueDate().toString()));
    }
    return simple(answer.toString(), AssistantIntent.OVERDUE_DEBTS.name(), Map.of("debts", list));
  }

  public AssistantQueryResponse dayCloseStatus(UUID orgId, UUID branchId) {
    boolean openShifts = shiftRepository.existsByBranchIdAndStatus(branchId, ShiftStatus.OPEN);
    String answer =
        openShifts
            ? "Day close blocked: at least one shift is still open on this branch."
            : "No open shifts on this branch — day close can proceed if counts are done.";
    return simple(
        answer, AssistantIntent.DAY_CLOSE_STATUS.name(), Map.of("hasOpenShifts", openShifts));
  }

  public AssistantQueryResponse stockVariance(UUID orgId, UUID branchId) {
    List<StockCountLine> lines =
        stockCountLineRepository.findTopVarianceByOrgAndBranch(
            orgId, branchId, PageRequest.of(0, LIMIT));
    if (lines.isEmpty()) {
      return simple(
          "No stock count variances recorded at this branch yet. Run a stock count session to compare counted vs system qty.",
          AssistantIntent.STOCK_VARIANCE.name(),
          Map.of());
    }
    StringBuilder answer = new StringBuilder("Largest stock count variances:");
    List<Map<String, Object>> list = new ArrayList<>();
    for (StockCountLine line : lines) {
      answer
          .append("\n• ")
          .append(line.getItem().getName())
          .append(" — variance ")
          .append(formatQty(line.getVarianceQty()))
          .append(" (counted ")
          .append(formatQty(line.getCountedQty()))
          .append(", system ")
          .append(formatQty(line.getSystemQty()))
          .append(")");
      list.add(
          Map.of(
              "itemId", line.getItem().getId().toString(),
              "itemName", line.getItem().getName(),
              "varianceQty", line.getVarianceQty(),
              "countedQty", line.getCountedQty(),
              "systemQty", line.getSystemQty()));
    }
    return simple(answer.toString(), AssistantIntent.STOCK_VARIANCE.name(), Map.of("lines", list));
  }

  public AssistantQueryResponse explainError(AssistantQueryContext context) {
    String extracted = extractRequestId(context.message());
    if (extracted == null && context.filters() != null) {
      extracted = context.filters().get("requestId");
    }
    final String requestId = extracted;
    if (requestId == null || requestId.isBlank()) {
      return simple(
          "Include a request reference (Ref: xxxxx) from an error message so I can look it up.",
          AssistantIntent.EXPLAIN_ERROR.name(),
          Map.of());
    }
    return queryLogRepository
        .findByOrgIdAndRequestId(context.orgId(), requestId)
        .map(log -> explainFromLog(log, requestId))
        .orElseGet(
            () ->
                simple(
                    "No assistant log found for Ref: "
                        + requestId
                        + ". If this was an API error, contact support with that reference.",
                    AssistantIntent.EXPLAIN_ERROR.name(),
                    Map.of("requestId", requestId)));
  }

  public AssistantQueryResponse supportBundle(AssistantQueryContext context) {
    String requestId = context.requestId() != null ? context.requestId() : "n/a";
    String bundle =
        String.format(
            Locale.ROOT,
            """
            XPOS support bundle
            Ref: %s
            Org: %s
            Branch: %s (%s)
            Staff: %s
            Screen: %s
            """,
            requestId,
            context.orgId(),
            context.branchName(),
            context.branchId(),
            context.staffDisplayName(),
            context.screen() != null ? context.screen() : "assistant");
    return simple(
        bundle.trim(), AssistantIntent.SUPPORT_BUNDLE.name(), Map.of("requestId", requestId));
  }

  private AssistantQueryResponse explainFromLog(AssistantQueryLog log, String requestId) {
    String answer =
        String.format(
            Locale.ROOT,
            "Ref %s: assistant query at %s, intent %s. Message: %s. If the issue persists, contact support with this Ref.",
            requestId,
            log.getCreatedAt(),
            log.getIntent(),
            log.getMessagePreview() != null ? log.getMessagePreview() : "(none)");
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("requestId", requestId);
    data.put("intent", log.getIntent());
    data.put("createdAt", log.getCreatedAt().toString());
    data.put("success", log.isSuccess());
    return simple(answer, AssistantIntent.EXPLAIN_ERROR.name(), data);
  }

  private static String extractRequestId(String message) {
    if (message == null) {
      return null;
    }
    Matcher matcher = UUID_PATTERN.matcher(message);
    if (matcher.find()) {
      return matcher.group();
    }
    return null;
  }

  private static String formatQty(BigDecimal qty) {
    if (qty == null) {
      return "0";
    }
    return qty.stripTrailingZeros().toPlainString();
  }

  private static AssistantQueryResponse simple(
      String answer, String intent, Map<String, Object> data) {
    return new AssistantQueryResponse(answer, intent, DEFAULT_SUGGESTIONS, data);
  }

  private static String formatMoney(BigDecimal amount) {
    if (amount == null) {
      return "KES 0.00";
    }
    NumberFormat nf = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-KE"));
    nf.setMinimumFractionDigits(2);
    nf.setMaximumFractionDigits(2);
    return nf.format(amount.setScale(2, RoundingMode.HALF_UP));
  }
}
