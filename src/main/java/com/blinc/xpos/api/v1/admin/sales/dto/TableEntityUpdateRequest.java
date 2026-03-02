package com.blinc.xpos.api.v1.admin.sales.dto;

import java.util.UUID;

public record TableEntityUpdateRequest(
    UUID tableAreaId, String name, Integer capacity, String status) {}
