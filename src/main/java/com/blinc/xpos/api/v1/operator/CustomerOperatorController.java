package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.admin.organization.dto.CustomerCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.CustomerResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.domain.Customer;
import com.blinc.xpos.modules.organization.service.CustomerService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Operator API for creating customers on-the-fly (e.g. when recording a debt).
 * Cashiers can type name and phone without pre-capturing in Admin.
 */
@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/customers")
public class CustomerOperatorController {

  private final CustomerService customerService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public CustomerOperatorController(
      CustomerService customerService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.customerService = Objects.requireNonNull(customerService, "customerService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public CustomerResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody CustomerCreateRequest request) {
    staffAuthorizationService.requireStaffUser(
        orgId, principalResolver.require().iamUserId());
    Customer customer =
        customerService.create(
            orgId,
            request.name(),
            request.phone(),
            request.email());
    return toResponse(customer);
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
