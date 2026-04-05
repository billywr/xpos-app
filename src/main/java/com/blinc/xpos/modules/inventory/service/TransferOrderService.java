package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.TransferOrder;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TransferOrderService {

  String STATUS_DRAFT = "DRAFT";
  String STATUS_SUBMITTED = "SUBMITTED";
  String STATUS_RECEIVED = "RECEIVED";
  String STATUS_CANCELLED = "CANCELLED";

  TransferOrder create(UUID orgId, UUID fromBranchId, UUID toBranchId);

  TransferOrder require(UUID orgId, UUID transferOrderId);

  Page<TransferOrder> list(UUID orgId, Pageable pageable);

  TransferOrder addLine(UUID orgId, UUID transferOrderId, UUID itemId, BigDecimal qty, UUID uomId);
}
