package com.blinc.xpos.api.v1.admin.compliance.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record EtimsInvoiceRecordCreateRequest(
    @NotNull(message = "Sale ID is required") UUID saleId) {}
