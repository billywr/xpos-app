package com.blinc.xpos.api.v1.operator.dto;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.domain.Page;

public record MiscExpenseListResponse(
    List<MiscExpenseResponse> content,
    long totalElements,
    int totalPages,
    int number,
    int size,
    BigDecimal totalAmount) {

  public static MiscExpenseListResponse from(
      Page<MiscExpenseResponse> page, BigDecimal totalAmount) {
    return new MiscExpenseListResponse(
        page.getContent(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.getNumber(),
        page.getSize(),
        totalAmount != null ? totalAmount : BigDecimal.ZERO);
  }
}
