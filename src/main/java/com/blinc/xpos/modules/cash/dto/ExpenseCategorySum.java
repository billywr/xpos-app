package com.blinc.xpos.modules.cash.dto;

import com.blinc.xpos.common.constants.enums.MiscExpenseCategory;
import java.math.BigDecimal;

/** Projection for expense totals grouped by category. */
public interface ExpenseCategorySum {

  MiscExpenseCategory getCategory();

  BigDecimal getAmount();
}
