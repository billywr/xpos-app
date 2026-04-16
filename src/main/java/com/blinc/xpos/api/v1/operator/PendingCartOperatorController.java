package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.sales.domain.PendingCart;
import com.blinc.xpos.modules.sales.repository.PendingCartRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}")
public class PendingCartOperatorController {

  private static final String EMPTY_CART_JSON =
      "{\"lines\":[],\"orderType\":\"DINE_IN\",\"tableId\":null,"
          + "\"customerId\":null,\"saleId\":null}";

  private final PendingCartRepository pendingCartRepository;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;
  private final Clock clock;

  public PendingCartOperatorController(
      PendingCartRepository pendingCartRepository,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService,
      Clock clock) {
    this.pendingCartRepository =
        Objects.requireNonNull(pendingCartRepository, "pendingCartRepository");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @GetMapping(value = "/pending-cart", produces = MediaType.APPLICATION_JSON_VALUE)
  @Transactional(readOnly = true)
  public String getCart(@PathVariable UUID orgId, @PathVariable UUID branchId) {
    String iamUserId = principalResolver.require().iamUserId();
    staffAuthorizationService.requireStaffUserForBranch(orgId, branchId, iamUserId);
    return pendingCartRepository
        .findByOrgIdAndBranchIdAndIamUserId(orgId, branchId, iamUserId)
        .map(PendingCart::getCartJson)
        .orElse(EMPTY_CART_JSON);
  }

  @PutMapping(value = "/pending-cart", consumes = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void saveCart(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @RequestBody String cartJson) {
    String iamUserId = principalResolver.require().iamUserId();
    staffAuthorizationService.requireStaffUserForBranch(orgId, branchId, iamUserId);

    PendingCart cart =
        pendingCartRepository
            .findByOrgIdAndBranchIdAndIamUserId(orgId, branchId, iamUserId)
            .orElseGet(
                () -> {
                  PendingCart newCart = new PendingCart();
                  Org org = new Org();
                  org.setId(orgId);
                  newCart.setOrg(org);
                  Branch branch = new Branch();
                  branch.setId(branchId);
                  newCart.setBranch(branch);
                  newCart.setIamUserId(iamUserId);
                  return newCart;
                });
    cart.setCartJson(cartJson);
    cart.setUpdatedAt(Instant.now(clock));
    pendingCartRepository.save(cart);
  }

  @DeleteMapping("/pending-cart")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void deleteCart(@PathVariable UUID orgId, @PathVariable UUID branchId) {
    String iamUserId = principalResolver.require().iamUserId();
    staffAuthorizationService.requireStaffUserForBranch(orgId, branchId, iamUserId);
    pendingCartRepository.deleteByOrgIdAndBranchIdAndIamUserId(orgId, branchId, iamUserId);
  }
}
