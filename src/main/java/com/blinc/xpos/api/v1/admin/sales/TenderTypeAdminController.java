package com.blinc.xpos.api.v1.admin.sales;

import com.blinc.xpos.api.v1.admin.sales.dto.TenderTypeCreateRequest;
import com.blinc.xpos.api.v1.admin.sales.dto.TenderTypeResponse;
import com.blinc.xpos.api.v1.admin.sales.dto.TenderTypeUpdateRequest;
import com.blinc.xpos.modules.sales.domain.TenderType;
import com.blinc.xpos.modules.sales.service.TenderTypeService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/tender-types")
public class TenderTypeAdminController {

  private final TenderTypeService tenderTypeService;

  public TenderTypeAdminController(TenderTypeService tenderTypeService) {
    this.tenderTypeService = Objects.requireNonNull(tenderTypeService, "tenderTypeService");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TenderTypeResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody TenderTypeCreateRequest request) {
    TenderType created = tenderTypeService.create(orgId, request.code(), request.name());
    return toResponse(created);
  }

  @GetMapping
  public List<TenderTypeResponse> list(
      @PathVariable UUID orgId,
      @RequestParam(required = false, defaultValue = "false") boolean includeInactive) {
    var list =
        includeInactive
            ? tenderTypeService.listByOrg(orgId)
            : tenderTypeService.listActiveByOrg(orgId);
    return list.stream().map(TenderTypeAdminController::toResponse).toList();
  }

  @GetMapping("/{tenderTypeId}")
  public TenderTypeResponse get(@PathVariable UUID orgId, @PathVariable UUID tenderTypeId) {
    return toResponse(tenderTypeService.require(orgId, tenderTypeId));
  }

  @PatchMapping("/{tenderTypeId}")
  public TenderTypeResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID tenderTypeId,
      @Valid @RequestBody TenderTypeUpdateRequest request) {
    TenderType updated =
        tenderTypeService.update(
            orgId, tenderTypeId, request.code(), request.name(), request.active());
    return toResponse(updated);
  }

  @DeleteMapping("/{tenderTypeId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID tenderTypeId) {
    tenderTypeService.delete(orgId, tenderTypeId);
  }

  private static TenderTypeResponse toResponse(TenderType t) {
    return new TenderTypeResponse(
        t.getId(), t.getOrg().getId(), t.getCode(), t.getName(), t.getActive(), t.getCreatedAt());
  }
}
