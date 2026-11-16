package com.blinc.xpos.modules.assistant;

/** Fixed assistant intents — each maps to a deterministic data tool (no SQL generation). */
public enum AssistantIntent {
  SALES_TODAY,
  TOP_ITEMS,
  TOP_DRINKS,
  LOW_STOCK,
  STOCK_VARIANCE,
  CATALOG_COUNT,
  OPEN_SHIFT,
  DEBT_SUMMARY,
  TOP_DEBTORS,
  OVERDUE_DEBTS,
  EXPENSES_TODAY,
  SESSION_CONTEXT,
  SHIFT_VARIANCE,
  PAYMENT_MIX,
  COMPARE_PERIODS,
  DAY_CLOSE_STATUS,
  EXPLAIN_ERROR,
  SUPPORT_BUNDLE,
  HELP,
  UNKNOWN
}
