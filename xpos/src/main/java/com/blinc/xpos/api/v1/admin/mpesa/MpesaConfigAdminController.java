package com.blinc.xpos.api.v1.admin.mpesa;

import com.blinc.xpos.modules.mpesa.dto.MpesaConfigCreateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigResponse;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigUpdateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigVerifyResponse;
import com.blinc.xpos.modules.mpesa.service.MpesaConfigService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/mpesa/configs")
public class MpesaConfigAdminController {

  private final MpesaConfigService mpesaConfigService;

  public MpesaConfigAdminController(MpesaConfigService mpesaConfigService) {
    this.mpesaConfigService = Objects.requireNonNull(mpesaConfigService);
  }

  @GetMapping
  public List<MpesaConfigResponse> list(@PathVariable UUID orgId) {
    return mpesaConfigService.listByOrg(orgId);
  }

  @GetMapping("/{configId}")
  public MpesaConfigResponse get(@PathVariable UUID orgId, @PathVariable UUID configId) {
    return mpesaConfigService.get(orgId, configId);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public MpesaConfigResponse createOrgDefault(
      @PathVariable UUID orgId, @Valid @RequestBody MpesaConfigCreateRequest request) {
    return mpesaConfigService.createOrgDefault(orgId, request);
  }

  @PostMapping("/branches/{branchId}")
  @ResponseStatus(HttpStatus.CREATED)
  public MpesaConfigResponse createBranchOverride(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody MpesaConfigCreateRequest request) {
    return mpesaConfigService.createBranchOverride(orgId, branchId, request);
  }

  @PatchMapping("/{configId}")
  public MpesaConfigResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID configId,
      @Valid @RequestBody MpesaConfigUpdateRequest request) {
    return mpesaConfigService.update(orgId, configId, request);
  }

  @PostMapping("/{configId}/verify")
  public MpesaConfigVerifyResponse verify(@PathVariable UUID orgId, @PathVariable UUID configId) {
    mpesaConfigService.verifyDarajaConnection(orgId, configId);
    var config = mpesaConfigService.get(orgId, configId);
    return new MpesaConfigVerifyResponse(
        true, config.environment(), "Daraja OAuth succeeded for " + config.environment() + ".");
  }

  @DeleteMapping("/{configId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deactivate(@PathVariable UUID orgId, @PathVariable UUID configId) {
    mpesaConfigService.deactivate(orgId, configId);
  }
}
