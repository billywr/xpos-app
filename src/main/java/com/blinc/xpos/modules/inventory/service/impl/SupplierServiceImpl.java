package com.blinc.xpos.modules.inventory.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.inventory.domain.Supplier;
import com.blinc.xpos.modules.inventory.repository.SupplierRepository;
import com.blinc.xpos.modules.inventory.service.SupplierService;
import com.blinc.xpos.modules.organization.service.OrgService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierServiceImpl implements SupplierService {

  private final SupplierRepository supplierRepository;
  private final OrgService orgService;
  private final Clock clock;

  public SupplierServiceImpl(
      SupplierRepository supplierRepository,
      OrgService orgService,
      Clock clock) {
    this.supplierRepository = Objects.requireNonNull(supplierRepository, "supplierRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Supplier create(UUID orgId, String name, String phone, String email) {
    var org = orgService.require(orgId);
    Supplier supplier = new Supplier();
    supplier.setOrg(org);
    supplier.setName(name);
    supplier.setPhone(phone != null && !phone.isBlank() ? phone.trim() : null);
    supplier.setEmail(email != null && !email.isBlank() ? email.trim() : null);
    supplier.setActive(true);
    Instant now = Instant.now(clock);
    supplier.setCreatedAt(now);
    supplier.setUpdatedAt(now);
    return supplierRepository.save(supplier);
  }

  @Override
  @Transactional(readOnly = true)
  public Supplier require(UUID orgId, UUID supplierId) {
    return supplierRepository
        .findByIdAndOrgId(supplierId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "SUPPLIER_NOT_FOUND", "Supplier not found: " + supplierId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Supplier> list(UUID orgId, Pageable pageable) {
    return supplierRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Supplier> listActiveOnly(UUID orgId, Pageable pageable) {
    return supplierRepository.findAllByOrgIdAndActiveTrue(orgId, pageable);
  }

  @Override
  @Transactional
  public Supplier update(
      UUID orgId,
      UUID supplierId,
      String name,
      String phone,
      String email,
      Boolean active) {
    Supplier supplier = require(orgId, supplierId);
    supplier.setName(name);
    supplier.setPhone(phone != null && !phone.isBlank() ? phone.trim() : null);
    supplier.setEmail(email != null && !email.isBlank() ? email.trim() : null);
    if (active != null) {
      supplier.setActive(active);
    }
    supplier.setUpdatedAt(Instant.now(clock));
    return supplierRepository.save(supplier);
  }
}
