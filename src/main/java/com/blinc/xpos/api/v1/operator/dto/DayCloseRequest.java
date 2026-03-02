package com.blinc.xpos.api.v1.operator.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record DayCloseRequest(@NotNull(message = "Business date is required") LocalDate businessDate) {}
