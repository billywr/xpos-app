package com.blinc.xpos.api.v1.admin.fraud;

import com.blinc.xpos.api.v1.admin.fraud.dto.ReasonCodeCreateRequest;
import com.blinc.xpos.api.v1.admin.fraud.dto.ReasonCodeResponse;
import com.blinc.xpos.api.v1.admin.fraud.dto.ReasonCodeUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.fraud.domain.ReasonCode;
import com.blinc.xpos.modules.fraud.service.ReasonCodeService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/reason-codes")
public class ReasonCodeAdminController {

  private final ReasonCodeService reasonCodeService;
  private final PageRequestFactory pageRequestFactory;

  public ReasonCodeAdminController(
      ReasonCodeService reasonCodeService,
      PageRequestFactory pageRequestFactory) {
    this.reasonCodeService = Objects.requireNonNull(reasonCodeService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ReasonCodeResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody ReasonCodeCreateRequest request) {
    ReasonCode created =
        reasonCodeService.create(orgId, request.code(), request.description());
    return toResponse(created);
  }

  @GetMapping
  public Page<ReasonCodeResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("code").ascending());
    return reasonCodeService.list(orgId, normalized).map(ReasonCodeAdminController::toResponse);
  }

  @GetMapping("/{reasonCodeId}")
  public ReasonCodeResponse get(
      @PathVariable UUID orgId, @PathVariable UUID reasonCodeId) {
    return toResponse(reasonCodeService.require(orgId, reasonCodeId));
  }

  @PatchMapping("/{reasonCodeId}")
  public ReasonCodeResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID reasonCodeId,
      @Valid @RequestBody ReasonCodeUpdateRequest request) {
    ReasonCode updated =
        reasonCodeService.update(
            orgId, reasonCodeId, request.description(), request.active());
    return toResponse(updated);
  }

  private static ReasonCodeResponse toResponse(ReasonCode r) {
    return new ReasonCodeResponse(
        r.getId(),
        r.getOrg().getId(),
        r.getCode(),
        r.getDescription(),
        r.getActive(),
        r.getCreatedAt());
  }
}
