package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.CustomerCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.CustomerResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.CustomerUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.service.CustomerService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/customers")
public class CustomerAdminController {

  private final CustomerService customerService;
  private final PageRequestFactory pageRequestFactory;

  public CustomerAdminController(
      CustomerService customerService, PageRequestFactory pageRequestFactory) {
    this.customerService = Objects.requireNonNull(customerService, "customerService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public CustomerResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody CustomerCreateRequest request) {
    Customer customer =
        customerService.create(orgId, request.name(), request.phone(), request.email());
    return toResponse(customer);
  }

  @GetMapping
  public Page<CustomerResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return customerService.list(orgId, normalized).map(CustomerAdminController::toResponse);
  }

  @GetMapping("/{customerId}")
  public CustomerResponse get(@PathVariable UUID orgId, @PathVariable UUID customerId) {
    return toResponse(customerService.require(orgId, customerId));
  }

  @PatchMapping("/{customerId}")
  public CustomerResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID customerId,
      @Valid @RequestBody CustomerUpdateRequest request) {
    Customer updated =
        customerService.update(
            orgId, customerId, request.name(), request.phone(), request.email(), request.active());
    return toResponse(updated);
  }

  private static CustomerResponse toResponse(Customer c) {
    return new CustomerResponse(
        c.getId(),
        c.getName(),
        c.getPhone(),
        c.getEmail(),
        c.getActive(),
        c.getCreatedAt(),
        c.getUpdatedAt());
  }
}
