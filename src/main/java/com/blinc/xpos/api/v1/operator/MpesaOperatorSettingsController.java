package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.modules.mpesa.dto.MpesaOperatorSettingsResponse;
import com.blinc.xpos.modules.mpesa.service.MpesaConfigService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/mpesa/operator-settings")
public class MpesaOperatorSettingsController {

  private final MpesaConfigService mpesaConfigService;

  public MpesaOperatorSettingsController(MpesaConfigService mpesaConfigService) {
    this.mpesaConfigService = Objects.requireNonNull(mpesaConfigService);
  }

  @GetMapping
  public MpesaOperatorSettingsResponse get(@PathVariable UUID orgId) {
    return mpesaConfigService.getOperatorSettings(orgId);
  }
}
