package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.NotBlank;

public record ItemBarcodeCreateRequest(@NotBlank(message = "Barcode is required") String barcode) {}
