package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.BindDeviceToTerminalRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.TerminalCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.TerminalResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.TerminalUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.Terminal;
import com.blinc.xpos.modules.organization.service.TerminalService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals")
public class TerminalAdminController {

  private final TerminalService terminalService;
  private final PageRequestFactory pageRequestFactory;

  public TerminalAdminController(
      TerminalService terminalService, PageRequestFactory pageRequestFactory) {
    this.terminalService = Objects.requireNonNull(terminalService, "terminalService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TerminalResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody TerminalCreateRequest request) {
    Terminal terminal =
        terminalService.create(orgId, branchId, request.terminalCode(), request.printerProfileId());
    return toResponse(terminal);
  }

  @GetMapping
  public Page<TerminalResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID branchId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return terminalService.listByBranch(orgId, branchId, normalized).map(this::toResponse);
  }

  @GetMapping("/{terminalId}")
  public TerminalResponse get(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID terminalId) {
    // branchId is part of the route for API clarity; authorization & org scoping is enforced by
    // service.
    return toResponse(terminalService.require(orgId, terminalId));
  }

  @PatchMapping("/{terminalId}")
  public TerminalResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @Valid @RequestBody TerminalUpdateRequest request) {
    Terminal updated =
        terminalService.update(
            orgId,
            terminalId,
            request.terminalCode(),
            request.deviceRegistrationId(),
            request.printerProfileId(),
            request.status());
    return toResponse(updated);
  }

  @DeleteMapping("/{terminalId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId) {
    terminalService.softDelete(orgId, branchId, terminalId);
  }

  @PostMapping("/{terminalId}/bind-device")
  public TerminalResponse bindDevice(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID terminalId,
      @Valid @RequestBody BindDeviceToTerminalRequest request) {
    Terminal updated =
        terminalService.bindDevice(orgId, terminalId, request.deviceRegistrationId());
    return toResponse(updated);
  }

  private TerminalResponse toResponse(Terminal terminal) {
    return new TerminalResponse(
        terminal.getId(),
        terminal.getOrg().getId(),
        terminal.getBranch().getId(),
        terminal.getTerminalCode(),
        terminal.getDeviceRegistration() == null ? null : terminal.getDeviceRegistration().getId(),
        terminal.getPrinterProfile() == null ? null : terminal.getPrinterProfile().getId(),
        terminal.getStatus(),
        terminal.getCreatedAt(),
        terminal.getUpdatedAt());
  }
}
