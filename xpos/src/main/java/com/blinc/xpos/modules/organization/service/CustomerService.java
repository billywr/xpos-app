package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.modules.organization.domain.Customer;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomerService {

  Customer create(UUID orgId, String name, String phone, String email);

  Customer require(UUID orgId, UUID customerId);

  Page<Customer> list(UUID orgId, Pageable pageable);

  Customer update(
      UUID orgId, UUID customerId, String name, String phone, String email, Boolean active);
}
