package com.blinc.xpos.api.v1.admin.catalog.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ItemModifierGroupLinkCreateRequest(
    @NotNull(message = "Modifier group is required") UUID modifierGroupId) {}
