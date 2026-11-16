package com.blinc.xpos.api.v1.admin.catalog.dto;

import java.util.List;
import java.util.UUID;

public record ItemIdsWithPricesResponse(List<UUID> itemIds) {}
