package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.time.Instant;
import java.util.UUID;

public record ItemBarcodeResponse(
    UUID id,
    UUID itemId,
    String barcode,
    Instant createdAt) {}
