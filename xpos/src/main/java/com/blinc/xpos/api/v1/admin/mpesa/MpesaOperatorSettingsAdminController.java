package com.blinc.xpos.api.v1.admin.mpesa;

import com.blinc.xpos.modules.mpesa.dto.MpesaOperatorSettingsResponse;
import com.blinc.xpos.modules.mpesa.dto.MpesaOperatorSettingsUpdateRequest;
import com.blinc.xpos.modules.mpesa.service.MpesaConfigService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/mpesa/operator-settings")
public class MpesaOperatorSettingsAdminController {

  private final MpesaConfigService mpesaConfigService;

  public MpesaOperatorSettingsAdminController(MpesaConfigService mpesaConfigService) {
    this.mpesaConfigService = Objects.requireNonNull(mpesaConfigService);
  }

  @GetMapping
  public MpesaOperatorSettingsResponse get(@PathVariable UUID orgId) {
    return mpesaConfigService.getOperatorSettings(orgId);
  }

  @PatchMapping
  public MpesaOperatorSettingsResponse update(
      @PathVariable UUID orgId, @Valid @RequestBody MpesaOperatorSettingsUpdateRequest request) {
    return mpesaConfigService.updateOperatorSettings(orgId, request.stkOperatorEnabled());
  }
}
