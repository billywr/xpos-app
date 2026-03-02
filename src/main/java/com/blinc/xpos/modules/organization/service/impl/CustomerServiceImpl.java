package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.common.error.NotFoundException;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.repository.CustomerRepository;
import com.blinc.xpos.modules.organization.service.CustomerService;
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
public class CustomerServiceImpl implements CustomerService {

  private final CustomerRepository customerRepository;
  private final OrgService orgService;
  private final Clock clock;

  public CustomerServiceImpl(
      CustomerRepository customerRepository, OrgService orgService, Clock clock) {
    this.customerRepository = Objects.requireNonNull(customerRepository, "customerRepository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional
  public Customer create(UUID orgId, String name, String phone, String email) {
    Org org = orgService.require(orgId);
    Customer customer = new Customer();
    customer.setOrg(org);
    customer.setName(name != null ? name.trim() : "");
    customer.setPhone(phone != null ? phone.trim() : null);
    customer.setEmail(email != null ? email.trim() : null);
    customer.setActive(true);
    Instant now = Instant.now(clock);
    customer.setCreatedAt(now);
    customer.setUpdatedAt(now);
    return customerRepository.save(customer);
  }

  @Override
  @Transactional(readOnly = true)
  public Customer require(UUID orgId, UUID customerId) {
    return customerRepository
        .findByIdAndOrgId(customerId, orgId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "CUSTOMER_NOT_FOUND", "Customer not found: " + customerId));
  }

  @Override
  @Transactional(readOnly = true)
  public Page<Customer> list(UUID orgId, Pageable pageable) {
    orgService.require(orgId);
    return customerRepository.findAllByOrgId(orgId, pageable);
  }

  @Override
  @Transactional
  public Customer update(
      UUID orgId,
      UUID customerId,
      String name,
      String phone,
      String email,
      Boolean active) {
    Customer customer = require(orgId, customerId);
    if (name != null) {
      customer.setName(name.trim());
    }
    if (phone != null) {
      customer.setPhone(phone.trim().isEmpty() ? null : phone.trim());
    }
    if (email != null) {
      customer.setEmail(email.trim().isEmpty() ? null : email.trim());
    }
    if (active != null) {
      customer.setActive(active);
    }
    customer.setUpdatedAt(Instant.now(clock));
    return customerRepository.save(customer);
  }
}
