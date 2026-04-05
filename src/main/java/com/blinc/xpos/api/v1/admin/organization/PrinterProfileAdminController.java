package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.PrinterProfileCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.PrinterProfileResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.PrinterProfileUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.PrinterProfile;
import com.blinc.xpos.modules.organization.service.PrinterProfileService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/printer-profiles")
public class PrinterProfileAdminController {

  private final PrinterProfileService printerProfileService;
  private final PageRequestFactory pageRequestFactory;
  private final ObjectMapper objectMapper;

  public PrinterProfileAdminController(
      PrinterProfileService printerProfileService,
      PageRequestFactory pageRequestFactory,
      ObjectMapper objectMapper) {
    this.printerProfileService =
        Objects.requireNonNull(printerProfileService, "printerProfileService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PrinterProfileResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody PrinterProfileCreateRequest request) {
    JsonNode config = objectMapper.valueToTree(request.configJson());
    PrinterProfile profile = printerProfileService.create(orgId, request.name(), config);
    return toResponse(profile);
  }

  @GetMapping
  public Page<PrinterProfileResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("name").ascending());
    return printerProfileService
        .list(orgId, normalized)
        .map(PrinterProfileAdminController::toResponse);
  }

  @GetMapping("/{profileId}")
  public PrinterProfileResponse get(@PathVariable UUID orgId, @PathVariable UUID profileId) {
    return toResponse(printerProfileService.require(orgId, profileId));
  }

  @PatchMapping("/{profileId}")
  public PrinterProfileResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID profileId,
      @Valid @RequestBody PrinterProfileUpdateRequest request) {
    JsonNode config =
        request.configJson() != null ? objectMapper.valueToTree(request.configJson()) : null;
    PrinterProfile updated =
        printerProfileService.update(orgId, profileId, request.name(), config, request.active());
    return toResponse(updated);
  }

  private static PrinterProfileResponse toResponse(PrinterProfile p) {
    return new PrinterProfileResponse(
        p.getId(),
        p.getName(),
        p.getConfigJson(),
        p.getActive(),
        p.getCreatedAt(),
        p.getUpdatedAt());
  }
}
