package com.blinc.xpos.api.v1.admin.ledger;

import com.blinc.xpos.api.v1.admin.ledger.dto.LedgerAccountCreateRequest;
import com.blinc.xpos.api.v1.admin.ledger.dto.LedgerAccountResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.ledger.domain.LedgerAccount;
import com.blinc.xpos.modules.ledger.service.LedgerAccountService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/ledger-accounts")
public class LedgerAccountAdminController {

  private final LedgerAccountService ledgerAccountService;
  private final PageRequestFactory pageRequestFactory;

  public LedgerAccountAdminController(
      LedgerAccountService ledgerAccountService,
      PageRequestFactory pageRequestFactory) {
    this.ledgerAccountService = Objects.requireNonNull(ledgerAccountService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public LedgerAccountResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody LedgerAccountCreateRequest request) {
    LedgerAccount created =
        ledgerAccountService.create(
            orgId,
            request.code(),
            request.name(),
            request.accountType());
    return toResponse(created);
  }

  @GetMapping
  public Page<LedgerAccountResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("code").ascending());
    return ledgerAccountService.list(orgId, normalized).map(LedgerAccountAdminController::toResponse);
  }

  @GetMapping("/{accountId}")
  public LedgerAccountResponse get(
      @PathVariable UUID orgId, @PathVariable UUID accountId) {
    return toResponse(ledgerAccountService.require(orgId, accountId));
  }

  private static LedgerAccountResponse toResponse(LedgerAccount a) {
    return new LedgerAccountResponse(
        a.getId(),
        a.getOrg().getId(),
        a.getCode(),
        a.getName(),
        a.getAccountType(),
        a.getActive(),
        a.getCreatedAt());
  }
}
