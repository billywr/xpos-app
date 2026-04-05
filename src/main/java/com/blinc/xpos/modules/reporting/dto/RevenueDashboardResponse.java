package com.blinc.xpos.modules.reporting.dto;

import java.util.List;

/** Full revenue dashboard payload: summary + daily trend for charts. */
public record RevenueDashboardResponse(
    RevenueSummaryResponse summary, List<RevenueTrendPointResponse> trend) {}
