package com.blinc.xpos.modules.cash.dto;

import java.math.BigDecimal;

/** Projection for expense totals grouped by category. */
public interface ExpenseCategorySum {

  String getCategory();

  BigDecimal getAmount();
}
