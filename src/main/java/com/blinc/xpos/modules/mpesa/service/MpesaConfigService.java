package com.blinc.xpos.modules.mpesa.service;

import com.blinc.xpos.modules.mpesa.domain.MpesaConfig;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigCreateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigResponse;
import com.blinc.xpos.modules.mpesa.dto.MpesaConfigUpdateRequest;
import com.blinc.xpos.modules.mpesa.dto.MpesaOperatorSettingsResponse;
import java.util.List;
import java.util.UUID;

public interface MpesaConfigService {

  MpesaConfig resolve(UUID orgId, UUID branchId);

  boolean isStkOperatorEnabled(UUID orgId);

  MpesaOperatorSettingsResponse getOperatorSettings(UUID orgId);

  MpesaOperatorSettingsResponse updateOperatorSettings(UUID orgId, boolean stkOperatorEnabled);

  boolean isAutoComplete(MpesaConfig config);

  List<MpesaConfigResponse> listByOrg(UUID orgId);

  MpesaConfigResponse get(UUID orgId, UUID configId);

  MpesaConfigResponse createOrgDefault(UUID orgId, MpesaConfigCreateRequest request);

  MpesaConfigResponse createBranchOverride(
      UUID orgId, UUID branchId, MpesaConfigCreateRequest request);

  MpesaConfigResponse update(UUID orgId, UUID configId, MpesaConfigUpdateRequest request);

  void verifyDarajaConnection(UUID orgId, UUID configId);

  void deactivate(UUID orgId, UUID configId);
}
