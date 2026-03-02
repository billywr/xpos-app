package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.ReceiptTemplateCreateRequest;
import com.blinc.xpos.api.v1.admin.organization.dto.ReceiptTemplateResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.ReceiptTemplateUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.ReceiptTemplate;
import com.blinc.xpos.modules.organization.service.ReceiptTemplateService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/receipt-templates")
public class ReceiptTemplateAdminController {

  private final ReceiptTemplateService receiptTemplateService;
  private final PageRequestFactory pageRequestFactory;
  private final ObjectMapper objectMapper;

  public ReceiptTemplateAdminController(
      ReceiptTemplateService receiptTemplateService,
      PageRequestFactory pageRequestFactory,
      ObjectMapper objectMapper) {
    this.receiptTemplateService =
        Objects.requireNonNull(receiptTemplateService, "receiptTemplateService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ReceiptTemplateResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody ReceiptTemplateCreateRequest request) {
    JsonNode templateJson = objectMapper.valueToTree(request.templateJson());
    ReceiptTemplate template =
        receiptTemplateService.create(orgId, request.name(), templateJson);
    return toResponse(template);
  }

  @GetMapping
  public Page<ReceiptTemplateResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("name").ascending());
    return receiptTemplateService.list(orgId, normalized)
        .map(ReceiptTemplateAdminController::toResponse);
  }

  @GetMapping("/{templateId}")
  public ReceiptTemplateResponse get(
      @PathVariable UUID orgId, @PathVariable UUID templateId) {
    return toResponse(receiptTemplateService.require(orgId, templateId));
  }

  @PatchMapping("/{templateId}")
  public ReceiptTemplateResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID templateId,
      @Valid @RequestBody ReceiptTemplateUpdateRequest request) {
    JsonNode templateJson = request.templateJson() != null
        ? objectMapper.valueToTree(request.templateJson()) : null;
    ReceiptTemplate updated =
        receiptTemplateService.update(
            orgId,
            templateId,
            request.name(),
            templateJson,
            request.active());
    return toResponse(updated);
  }

  private static ReceiptTemplateResponse toResponse(ReceiptTemplate t) {
    return new ReceiptTemplateResponse(
        t.getId(),
        t.getName(),
        t.getTemplateJson(),
        t.getActive(),
        t.getCreatedAt(),
        t.getUpdatedAt());
  }
}
