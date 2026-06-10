package com.blinc.xpos.modules.assistant.service.impl;

import com.blinc.xpos.api.v1.operator.dto.AnalyticsSnapshotResponse;
import com.blinc.xpos.common.error.ApiException;
import com.blinc.xpos.config.AssistantProperties;
import com.blinc.xpos.modules.assistant.AssistantIntent;
import com.blinc.xpos.modules.assistant.AssistantIntentRouter;
import com.blinc.xpos.modules.assistant.AssistantLlmBudgetGuard;
import com.blinc.xpos.modules.assistant.AssistantLlmOrchestrator;
import com.blinc.xpos.modules.assistant.AssistantRateLimiter;
import com.blinc.xpos.modules.assistant.AssistantTimeRange;
import com.blinc.xpos.modules.assistant.AssistantTimeRangeParser;
import com.blinc.xpos.modules.assistant.AssistantToolAllowlist;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryContext;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryResponse;
import com.blinc.xpos.modules.assistant.service.AssistantExtendedTools;
import com.blinc.xpos.modules.assistant.service.AssistantQueryService;
import com.blinc.xpos.modules.assistant.service.AssistantUsageService;
import com.blinc.xpos.modules.auditvault.service.AuditLogService;
import com.blinc.xpos.modules.catalog.repository.ItemRepository;
import com.blinc.xpos.modules.debt.dto.TopDebtorProjection;
import com.blinc.xpos.modules.debt.repository.CustomerDebtRepository;
import com.blinc.xpos.modules.inventory.domain.InventoryItem;
import com.blinc.xpos.modules.inventory.repository.InventoryItemRepository;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.blinc.xpos.modules.reporting.service.OperatorAnalyticsService;
import com.blinc.xpos.modules.sales.dto.TopItemProjection;
import com.blinc.xpos.modules.sales.repository.SaleLineRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssistantQueryServiceImpl implements AssistantQueryService {

  private static final int TOP_LIMIT = 5;
  private static final int LOW_STOCK_LIMIT = 10;

  private static final List<String> DEFAULT_SUGGESTIONS =
      List.of(
          "Sales today",
          "Who am I?",
          "Top selling items",
          "Low stock",
          "Outstanding debt",
          "Payment mix",
          "Overdue debts");

  private final OperatorAnalyticsService analyticsService;
  private final OrgService orgService;
  private final ItemRepository itemRepository;
  private final CustomerDebtRepository customerDebtRepository;
  private final InventoryItemRepository inventoryItemRepository;
  private final SaleLineRepository saleLineRepository;
  private final AuditLogService auditLogService;
  private final AssistantRateLimiter rateLimiter;
  private final AssistantProperties properties;
  private final AssistantLlmOrchestrator llmOrchestrator;
  private final AssistantExtendedTools extendedTools;
  private final AssistantUsageService usageService;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public AssistantQueryServiceImpl(
      OperatorAnalyticsService analyticsService,
      OrgService orgService,
      ItemRepository itemRepository,
      CustomerDebtRepository customerDebtRepository,
      InventoryItemRepository inventoryItemRepository,
      SaleLineRepository saleLineRepository,
      AuditLogService auditLogService,
      AssistantRateLimiter rateLimiter,
      AssistantProperties properties,
      AssistantLlmOrchestrator llmOrchestrator,
      AssistantExtendedTools extendedTools,
      AssistantUsageService usageService,
      ObjectMapper objectMapper,
      Clock clock) {
    this.analyticsService = Objects.requireNonNull(analyticsService, "analyticsService");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.itemRepository = Objects.requireNonNull(itemRepository, "itemRepository");
    this.customerDebtRepository =
        Objects.requireNonNull(customerDebtRepository, "customerDebtRepository");
    this.inventoryItemRepository =
        Objects.requireNonNull(inventoryItemRepository, "inventoryItemRepository");
    this.saleLineRepository = Objects.requireNonNull(saleLineRepository, "saleLineRepository");
    this.auditLogService = Objects.requireNonNull(auditLogService, "auditLogService");
    this.rateLimiter = Objects.requireNonNull(rateLimiter, "rateLimiter");
    this.properties = Objects.requireNonNull(properties, "properties");
    this.llmOrchestrator = Objects.requireNonNull(llmOrchestrator, "llmOrchestrator");
    this.extendedTools = Objects.requireNonNull(extendedTools, "extendedTools");
    this.usageService = Objects.requireNonNull(usageService, "usageService");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public AssistantQueryResponse query(AssistantQueryContext context) {
    Objects.requireNonNull(context, "context");
    long started = clock.millis();
    if (!rateLimiter.tryAcquire(context.staffUserId(), properties.getRateLimitPerHour())) {
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "ASSISTANT_RATE_LIMIT",
          "Too many assistant queries. Try again later.");
    }

    String message = context.message();
    AssistantIntent intent = AssistantIntentRouter.resolve(message);
    boolean llmUsed = false;
    int llmTokens = 0;

    if (intent == AssistantIntent.UNKNOWN) {
      AssistantLlmBudgetGuard.LlmRouteResult route =
          llmOrchestrator.classify(context.orgId(), message);
      intent = route.intent();
      llmUsed = route.llmUsed();
      llmTokens = route.tokensUsed();
    }

    AssistantQueryResponse response = null;
    boolean success = true;
    try {
      if (intent == AssistantIntent.HELP) {
        response = helpResponse(context);
      } else if (intent == AssistantIntent.UNKNOWN) {
        response = unrecognizedResponse(message, context);
      } else if (!AssistantToolAllowlist.isAllowed(intent, context.adminAccess())) {
        response = forbiddenToolResponse(intent);
      } else {
        response = executeIntent(context, intent);
      }
    } catch (RuntimeException ex) {
      success = false;
      throw ex;
    }

    long latencyMs = clock.millis() - started;
    String toolName = response.intent();
    response =
        usageService.finalizeResponse(response, toolName, context.requestId(), llmUsed, latencyMs);
    usageService.logQuery(
        context.orgId(),
        context.branchId(),
        context.staffUserId(),
        context.requestId(),
        toolName,
        preview(message),
        llmUsed,
        llmTokens,
        latencyMs,
        success);
    appendAudit(
        context.orgId(),
        context.branchId(),
        context.staffUserId(),
        message,
        toolName,
        llmUsed,
        latencyMs);
    return response;
  }

  private AssistantQueryResponse executeIntent(
      AssistantQueryContext context, AssistantIntent intent) {
    UUID orgId = context.orgId();
    UUID branchId = context.branchId();
    if (intent == AssistantIntent.SESSION_CONTEXT) {
      return sessionContext(context);
    }
    if (intent == AssistantIntent.SALES_TODAY) {
      return salesSummary(orgId, branchId, context.message());
    }
    if (intent == AssistantIntent.TOP_ITEMS) {
      return topItems(orgId, branchId, null, context.message());
    }
    if (intent == AssistantIntent.TOP_DRINKS) {
      return topItems(orgId, branchId, "drink", context.message());
    }
    if (intent == AssistantIntent.LOW_STOCK) {
      return lowStock(orgId, branchId);
    }
    if (intent == AssistantIntent.STOCK_VARIANCE) {
      return extendedTools.stockVariance(orgId, branchId);
    }
    if (intent == AssistantIntent.CATALOG_COUNT) {
      return catalogCount(orgId);
    }
    if (intent == AssistantIntent.OPEN_SHIFT) {
      return openShift(orgId, branchId);
    }
    if (intent == AssistantIntent.DEBT_SUMMARY) {
      return debtSummary(orgId, branchId);
    }
    if (intent == AssistantIntent.TOP_DEBTORS) {
      return topDebtors(orgId, branchId);
    }
    if (intent == AssistantIntent.OVERDUE_DEBTS) {
      return extendedTools.overdueDebts(orgId, branchId);
    }
    if (intent == AssistantIntent.EXPENSES_TODAY) {
      return expensesSummary(orgId, branchId, context.message());
    }
    if (intent == AssistantIntent.SHIFT_VARIANCE) {
      return extendedTools.shiftVariance(orgId, branchId);
    }
    if (intent == AssistantIntent.PAYMENT_MIX) {
      return extendedTools.paymentMix(orgId, branchId);
    }
    if (intent == AssistantIntent.COMPARE_PERIODS) {
      return extendedTools.comparePeriods(orgId, branchId);
    }
    if (intent == AssistantIntent.DAY_CLOSE_STATUS) {
      return extendedTools.dayCloseStatus(orgId, branchId);
    }
    if (intent == AssistantIntent.EXPLAIN_ERROR) {
      return extendedTools.explainError(context);
    }
    if (intent == AssistantIntent.SUPPORT_BUNDLE) {
      return extendedTools.supportBundle(context);
    }
    return helpResponse(context);
  }

  private AssistantQueryResponse salesSummary(UUID orgId, UUID branchId, String message) {
    AnalyticsSnapshotResponse snap = analyticsService.getSnapshot(orgId, branchId, null, null);
    ZoneId zone = ZoneId.of(snap.timezone());
    AssistantTimeRange range = AssistantTimeRangeParser.resolve(message, zone);
    AnalyticsSnapshotResponse periodSnap =
        range.isSingleDay() && "today".equals(range.label())
            ? snap
            : analyticsService.getSnapshot(orgId, branchId, range.fromDate(), range.toDate());
    AnalyticsSnapshotResponse.Summary s = periodSnap.summary();
    String answer =
        String.format(
            Locale.ROOT,
            "%s: %d sale(s), revenue %s, average ticket %s (tax %s).",
            capitalize(range.label()),
            s.todaySaleCount(),
            formatMoney(s.todayRevenue()),
            formatMoney(s.todayAvgTicket()),
            formatMoney(s.todayTaxTotal()));
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("period", range.label());
    data.put("fromDate", range.fromDate().toString());
    data.put("toDate", range.toDate().toString());
    data.put("saleCount", s.todaySaleCount());
    data.put("revenue", s.todayRevenue());
    data.put("avgTicket", s.todayAvgTicket());
    return wrap(answer, AssistantIntent.SALES_TODAY.name(), data);
  }

  private AssistantQueryResponse topItems(
      UUID orgId, UUID branchId, String categoryPattern, String message) {
    AnalyticsSnapshotResponse snap = analyticsService.getSnapshot(orgId, branchId, null, null);
    ZoneId zone = ZoneId.of(snap.timezone());
    AssistantTimeRange range = AssistantTimeRangeParser.resolve(message, zone);
    Instant start = range.rangeStart(zone);
    Instant end = range.rangeEndExclusive(zone);
    List<TopItemProjection> rows =
        categoryPattern == null
            ? saleLineRepository.findTopItemsByBranchAndDateRange(
                orgId, branchId, start, end, PageRequest.of(0, TOP_LIMIT))
            : saleLineRepository.findTopItemsByBranchCategoryPatternAndDateRange(
                orgId, branchId, start, end, categoryPattern, PageRequest.of(0, TOP_LIMIT));

    String periodLabel = range.label();
    String itemLabel = categoryPattern == null ? "items" : "drinks";
    if (rows.isEmpty()) {
      return wrap(
          "No completed sales for " + itemLabel + " " + periodLabel + " yet.",
          categoryPattern == null
              ? AssistantIntent.TOP_ITEMS.name()
              : AssistantIntent.TOP_DRINKS.name(),
          Map.of("period", periodLabel));
    }

    String heading =
        categoryPattern == null
            ? "Top sellers " + periodLabel + ":"
            : "Top drinks " + periodLabel + ":";
    StringBuilder answer = new StringBuilder(heading);
    List<Map<String, Object>> list = new ArrayList<>();
    for (TopItemProjection row : rows) {
      answer
          .append("\n• ")
          .append(row.itemName())
          .append(" — ")
          .append(formatQty(row.totalQty()))
          .append(" units, ")
          .append(formatMoney(row.totalRevenue()));
      list.add(
          Map.of(
              "itemId", row.itemId().toString(),
              "name", row.itemName(),
              "qty", row.totalQty(),
              "revenue", row.totalRevenue()));
    }
    String intent =
        categoryPattern == null
            ? AssistantIntent.TOP_ITEMS.name()
            : AssistantIntent.TOP_DRINKS.name();
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("period", periodLabel);
    data.put("fromDate", range.fromDate().toString());
    data.put("toDate", range.toDate().toString());
    data.put("topItems", list);
    return wrap(answer.toString(), intent, data);
  }

  private AssistantQueryResponse lowStock(UUID orgId, UUID branchId) {
    List<InventoryItem> items =
        inventoryItemRepository.findLowStockByOrgAndBranch(
            orgId, branchId, PageRequest.of(0, LOW_STOCK_LIMIT));
    if (items.isEmpty()) {
      return wrap(
          "No items at or below reorder point for this branch.",
          AssistantIntent.LOW_STOCK.name(),
          Map.of());
    }
    StringBuilder answer = new StringBuilder("Restock soon (on hand ≤ reorder point):");
    List<Map<String, Object>> list = new ArrayList<>();
    for (InventoryItem inv : items) {
      answer
          .append("\n• ")
          .append(inv.getItem().getName())
          .append(" — on hand ")
          .append(formatQty(inv.getOnHandQty()))
          .append(", reorder at ")
          .append(formatQty(inv.getReorderPoint()));
      list.add(
          Map.of(
              "itemId", inv.getItem().getId().toString(),
              "name", inv.getItem().getName(),
              "onHandQty", inv.getOnHandQty(),
              "reorderPoint", inv.getReorderPoint()));
    }
    return wrap(answer.toString(), AssistantIntent.LOW_STOCK.name(), Map.of("items", list));
  }

  private AssistantQueryResponse catalogCount(UUID orgId) {
    long count = itemRepository.countActiveByOrgId(orgId);
    return wrap(
        String.format(Locale.ROOT, "This organization has %d active catalog item(s).", count),
        AssistantIntent.CATALOG_COUNT.name(),
        Map.of("activeItemCount", count));
  }

  private AssistantQueryResponse openShift(UUID orgId, UUID branchId) {
    AnalyticsSnapshotResponse.OpenShift shift =
        analyticsService.getSnapshot(orgId, branchId, null, null).openShift();
    if (!shift.hasOpenShift()) {
      return wrap(
          "No open shift on this branch right now.",
          AssistantIntent.OPEN_SHIFT.name(),
          Map.of("hasOpenShift", false));
    }
    String answer =
        String.format(
            Locale.ROOT,
            "Shift is open. Expected cash in drawer: %s.",
            formatMoney(shift.expectedCashInDrawer()));
    return wrap(
        answer,
        AssistantIntent.OPEN_SHIFT.name(),
        Map.of("hasOpenShift", true, "expectedCash", shift.expectedCashInDrawer()));
  }

  private AssistantQueryResponse debtSummary(UUID orgId, UUID branchId) {
    AnalyticsSnapshotResponse.DebtIntelligence debt =
        analyticsService.getSnapshot(orgId, branchId, null, null).debtIntelligence();
    String answer =
        String.format(
            Locale.ROOT,
            "Customer debt: outstanding %s (%d open), overdue %s, payment rate %s%%.",
            formatMoney(debt.totalOutstanding()),
            debt.openDebtCount(),
            formatMoney(debt.overdueAmount()),
            debt.paymentRatePercent() != null ? debt.paymentRatePercent().toPlainString() : "0");
    return wrap(
        answer,
        AssistantIntent.DEBT_SUMMARY.name(),
        Map.of(
            "totalOutstanding", debt.totalOutstanding(),
            "openDebtCount", debt.openDebtCount(),
            "overdueAmount", debt.overdueAmount()));
  }

  private AssistantQueryResponse topDebtors(UUID orgId, UUID branchId) {
    List<TopDebtorProjection> rows =
        customerDebtRepository.findTopDebtorsByOrgAndBranch(
            orgId, branchId, PageRequest.of(0, TOP_LIMIT));
    if (rows.isEmpty()) {
      return wrap(
          "No open customer debts at this branch.", AssistantIntent.TOP_DEBTORS.name(), Map.of());
    }
    StringBuilder answer = new StringBuilder("Customers owing the most:");
    List<Map<String, Object>> list = new ArrayList<>();
    for (TopDebtorProjection row : rows) {
      answer
          .append("\n• ")
          .append(row.customerName())
          .append(" — ")
          .append(formatMoney(row.outstandingAmount()));
      list.add(
          Map.of(
              "customerId", row.customerId().toString(),
              "customerName", row.customerName(),
              "outstandingAmount", row.outstandingAmount()));
    }
    return wrap(answer.toString(), AssistantIntent.TOP_DEBTORS.name(), Map.of("topDebtors", list));
  }

  private AssistantQueryResponse expensesSummary(UUID orgId, UUID branchId, String message) {
    AnalyticsSnapshotResponse snap = analyticsService.getSnapshot(orgId, branchId, null, null);
    ZoneId zone = ZoneId.of(snap.timezone());
    AssistantTimeRange range = AssistantTimeRangeParser.resolve(message, zone);
    AnalyticsSnapshotResponse periodSnap =
        range.isSingleDay() && "today".equals(range.label())
            ? snap
            : analyticsService.getSnapshot(orgId, branchId, range.fromDate(), range.toDate());
    AnalyticsSnapshotResponse.ExpenseIntelligence exp = periodSnap.expenseIntelligence();
    StringBuilder answer =
        new StringBuilder(
            "Misc expenses " + range.label() + ": " + formatMoney(exp.todayTotal()) + ".");
    if (exp.byCategory() != null && !exp.byCategory().isEmpty()) {
      answer.append(" By category:");
      for (AnalyticsSnapshotResponse.ExpenseByCategory row : exp.byCategory()) {
        answer.append("\n• ").append(row.category()).append(": ").append(formatMoney(row.amount()));
      }
    }
    return wrap(
        answer.toString(),
        AssistantIntent.EXPENSES_TODAY.name(),
        Map.of("todayTotal", exp.todayTotal()));
  }

  private AssistantQueryResponse sessionContext(AssistantQueryContext context) {
    String orgName = orgService.require(context.orgId()).getName();
    String answer =
        String.format(
            Locale.ROOT,
            "You are signed in as %s at %s (%s). Branch insights are scoped to this branch.",
            context.staffDisplayName(),
            context.branchName(),
            orgName);
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("staffDisplayName", context.staffDisplayName());
    data.put("iamUserId", context.iamUserId());
    data.put("branchName", context.branchName());
    data.put("orgName", orgName);
    return wrap(answer, AssistantIntent.SESSION_CONTEXT.name(), data);
  }

  private AssistantQueryResponse unrecognizedResponse(
      String message, AssistantQueryContext context) {
    String preview = message.length() > 80 ? message.substring(0, 80).trim() + "…" : message.trim();
    String answer =
        String.format(
            Locale.ROOT,
            """
            I don't have live data for "%s" yet.
            Try sales, stock, debt, expenses, shift status, or ask who is logged in.
            Tap a suggestion below.""",
            preview);
    return wrap(answer, AssistantIntent.UNKNOWN.name(), Map.of(), contextualSuggestions(context));
  }

  private AssistantQueryResponse helpResponse(AssistantQueryContext context) {
    return wrap(
        """
        I can answer branch-scoped questions such as:
        • Sales and revenue (today, this week, yesterday, this month)
        • Top selling items or popular drinks for a time period
        • Low stock / reorder alerts and stock count variance
        • Open shift, cash variance, and day close status
        • Customer debt, overdue balances, and misc expenses
        • Payment mix and period comparison
        • Explain errors by Ref (request ID) or copy a support bundle
        • Who is logged in and current branch
        Tap a suggestion below or ask in your own words.""",
        AssistantIntent.HELP.name(),
        Map.of(),
        contextualSuggestions(context));
  }

  private AssistantQueryResponse forbiddenToolResponse(AssistantIntent intent) {
    return wrap(
        "You don't have permission to use this assistant tool: " + intent.name() + ".",
        AssistantIntent.UNKNOWN.name(),
        Map.of("deniedIntent", intent.name()));
  }

  private AssistantQueryResponse wrap(String answer, String intent, Map<String, Object> data) {
    return wrap(answer, intent, data, DEFAULT_SUGGESTIONS);
  }

  private AssistantQueryResponse wrap(
      String answer, String intent, Map<String, Object> data, List<String> suggestions) {
    return new AssistantQueryResponse(
        answer, intent, suggestions, data, List.of(), null, clock.instant(), false, 0L);
  }

  private static List<String> contextualSuggestions(AssistantQueryContext context) {
    if (context.screen() == null) {
      return DEFAULT_SUGGESTIONS;
    }
    String screen = context.screen();
    if ("analytics".equals(screen)) {
      return List.of(
          "Compare periods", "Payment mix", "Sales today", "Top selling items this week");
    }
    if ("inventory".equals(screen)) {
      return List.of("Low stock", "Stock variance", "Restock alerts");
    }
    if ("shift".equals(screen)) {
      return List.of("Shift variance", "Why is drawer off?", "Day close status");
    }
    if ("stock-count".equals(screen)) {
      return List.of("Stock variance", "Low stock", "Explain variance");
    }
    return DEFAULT_SUGGESTIONS;
  }

  private void appendAudit(
      UUID orgId,
      UUID branchId,
      UUID staffUserId,
      String message,
      String intent,
      boolean llmUsed,
      long latencyMs) {
    ObjectNode after = objectMapper.createObjectNode();
    after.put("intent", intent);
    after.put("messagePreview", preview(message));
    after.put("llmUsed", llmUsed);
    after.put("latencyMs", latencyMs);
    auditLogService.append(
        orgId,
        branchId,
        null,
        staffUserId,
        "ASSISTANT_QUERY",
        "AssistantQuery",
        branchId,
        null,
        after);
  }

  private static String preview(String message) {
    return message.length() > 120 ? message.substring(0, 120) : message;
  }

  private static String capitalize(String label) {
    if (label == null || label.isBlank()) {
      return "Today";
    }
    return Character.toUpperCase(label.charAt(0)) + label.substring(1);
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

  private static String formatQty(BigDecimal qty) {
    if (qty == null) {
      return "0";
    }
    return qty.stripTrailingZeros().toPlainString();
  }
}
