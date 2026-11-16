package com.blinc.xpos.api.v1.operator.dto;

import java.util.UUID;

public record TableEntityListResponse(
    UUID id, UUID tableAreaId, String name, Integer capacity, String status) {}
