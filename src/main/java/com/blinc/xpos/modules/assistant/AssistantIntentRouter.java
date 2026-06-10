package com.blinc.xpos.modules.assistant;

import java.util.Locale;

/** Zero-token keyword router for common operator questions. */
public final class AssistantIntentRouter {

  private AssistantIntentRouter() {}

  public static AssistantIntent resolve(String rawMessage) {
    if (rawMessage == null || rawMessage.isBlank()) {
      return AssistantIntent.UNKNOWN;
    }
    String m = rawMessage.toLowerCase(Locale.ROOT).trim();

    if (containsAny(m, "help", "what can you", "what do you", "how do i ask")) {
      return AssistantIntent.HELP;
    }
    if (sessionContextMatch(m)) {
      return AssistantIntent.SESSION_CONTEXT;
    }
    if (containsAny(m, "support bundle", "copy support", "support ref")) {
      return AssistantIntent.SUPPORT_BUNDLE;
    }
    if (containsAny(m, "explain error", "what went wrong", "ref:", "request id", "requestid")) {
      return AssistantIntent.EXPLAIN_ERROR;
    }
    if (containsAny(m, "low stock", "restock", "reorder", "running out", "need to order")) {
      return AssistantIntent.LOW_STOCK;
    }
    if (containsAny(m, "stock variance", "count variance", "shrinkage", "stock count off")) {
      return AssistantIntent.STOCK_VARIANCE;
    }
    if (containsAny(
        m, "how many item", "unique item", "catalog", "products in system", "items in")) {
      return AssistantIntent.CATALOG_COUNT;
    }
    if (topDebtorsMatch(m)) {
      return AssistantIntent.TOP_DEBTORS;
    }
    if (containsAny(m, "overdue", "past due", "late debt")) {
      return AssistantIntent.OVERDUE_DEBTS;
    }
    if (containsAny(m, "debt", "owing", "outstanding debt", "customer owe")) {
      return AssistantIntent.DEBT_SUMMARY;
    }
    if (containsAny(m, "payment mix", "tender mix", "cash vs mpesa", "payment breakdown")) {
      return AssistantIntent.PAYMENT_MIX;
    }
    if (containsAny(m, "compare", "vs yesterday", "vs last week", "percent change")) {
      return AssistantIntent.COMPARE_PERIODS;
    }
    if (containsAny(m, "shift variance", "cash variance", "drawer off", "drawer variance")) {
      return AssistantIntent.SHIFT_VARIANCE;
    }
    if (containsAny(m, "day close", "close day", "end of day", "eod")) {
      return AssistantIntent.DAY_CLOSE_STATUS;
    }
    if (containsAny(m, "expense", "expenses", "misc expense")) {
      return AssistantIntent.EXPENSES_TODAY;
    }
    if (containsAny(m, "open shift", "shift open", "cash in drawer", "drawer")) {
      return AssistantIntent.OPEN_SHIFT;
    }
    if (containsAny(m, "drink", "beer", "wine", "beverage", "soda", "spirit")) {
      return AssistantIntent.TOP_DRINKS;
    }
    if (containsAny(
        m,
        "top selling",
        "top item",
        "best seller",
        "popular item",
        "popular drink",
        "popular drinks",
        "most sold",
        "best performing")) {
      return AssistantIntent.TOP_ITEMS;
    }
    if (containsAny(
        m,
        "sales today",
        "sale today",
        "how many sales",
        "revenue today",
        "sales made",
        "sold today",
        "today sales",
        "today revenue",
        "average ticket")) {
      return AssistantIntent.SALES_TODAY;
    }
    if (salesForPeriodMatch(m)) {
      return AssistantIntent.SALES_TODAY;
    }
    return AssistantIntent.UNKNOWN;
  }

  private static boolean salesForPeriodMatch(String message) {
    if (!AssistantTimeRangeParser.hasExplicitPeriod(message)) {
      return false;
    }
    return containsAny(
        message, "sales", "revenue", "sold", "average ticket", "how many sale", "sales made");
  }

  private static boolean topDebtorsMatch(String message) {
    if (containsAny(
        message,
        "most debt",
        "biggest debt",
        "largest debt",
        "highest debt",
        "top debtor",
        "who owes the most",
        "who owes most",
        "most owing",
        "biggest owing")) {
      return true;
    }
    return message.contains("debt")
        && containsAny(message, "most", "biggest", "largest", "highest", "top", "who");
  }

  private static boolean sessionContextMatch(String message) {
    if (containsAny(
        message,
        "who am i",
        "whoami",
        "logged in",
        "logged on",
        "signed in",
        "current user",
        "which user",
        "my login",
        "who is logged",
        "who's logged",
        "which staff",
        "which branch am i",
        "what branch am i",
        "where am i")) {
      return true;
    }
    boolean identityTopic =
        message.contains("user") || message.contains("staff") || message.contains("operator");
    boolean identityAction =
        containsAny(message, "logged", "login", "signed", "current", "which", "who");
    return identityTopic && identityAction;
  }

  private static boolean containsAny(String message, String... needles) {
    for (String needle : needles) {
      if (message.contains(needle)) {
        return true;
      }
    }
    return false;
  }
}
