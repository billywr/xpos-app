package com.blinc.xpos.modules.inventory.service;

import com.blinc.xpos.modules.inventory.domain.Supplier;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface SupplierService {

  Supplier create(UUID orgId, String name, String phone, String email);

  Supplier require(UUID orgId, UUID supplierId);

  Page<Supplier> list(UUID orgId, Pageable pageable);

  Page<Supplier> listActiveOnly(UUID orgId, Pageable pageable);

  Supplier update(
      UUID orgId, UUID supplierId, String name, String phone, String email, Boolean active);
}
