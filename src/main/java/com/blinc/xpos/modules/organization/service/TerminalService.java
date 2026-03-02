package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.Terminal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TerminalService {

  Terminal create(UUID orgId, UUID branchId, String terminalCode, UUID printerProfileId);

  Terminal require(UUID orgId, UUID terminalId);

  Page<Terminal> listByBranch(UUID orgId, UUID branchId, Pageable pageable);

  Terminal update(
      UUID orgId,
      UUID terminalId,
      String terminalCode,
      UUID deviceRegistrationId,
      UUID printerProfileId,
      StatusCommon status);

  Terminal bindDevice(UUID orgId, UUID terminalId, UUID deviceRegistrationId);

  void softDelete(UUID orgId, UUID branchId, UUID terminalId);
}
