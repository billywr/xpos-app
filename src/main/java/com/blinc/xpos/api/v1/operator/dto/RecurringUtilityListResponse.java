package com.blinc.xpos.api.v1.operator.dto;

import java.util.List;

public record RecurringUtilityListResponse(
    List<RecurringUtilityResponse> items, int page, int size, long totalElements, int totalPages) {}
