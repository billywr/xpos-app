package com.blinc.xpos.api.v1.admin.sales;

import com.blinc.xpos.api.v1.admin.sales.dto.TableAreaCreateRequest;
import com.blinc.xpos.api.v1.admin.sales.dto.TableAreaResponse;
import com.blinc.xpos.api.v1.admin.sales.dto.TableAreaUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.sales.domain.TableArea;
import com.blinc.xpos.modules.sales.service.TableAreaService;
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
@RequestMapping("/api/v1/admin/orgs/{orgId}/branches/{branchId}/table-areas")
public class TableAreaAdminController {

  private final TableAreaService tableAreaService;
  private final PageRequestFactory pageRequestFactory;

  public TableAreaAdminController(
      TableAreaService tableAreaService, PageRequestFactory pageRequestFactory) {
    this.tableAreaService = Objects.requireNonNull(tableAreaService, "tableAreaService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TableAreaResponse create(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @Valid @RequestBody TableAreaCreateRequest request) {
    TableArea area = tableAreaService.create(orgId, branchId, request.name());
    return toResponse(area);
  }

  @GetMapping
  public Page<TableAreaResponse> list(
      @PathVariable UUID orgId, @PathVariable UUID branchId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("name").ascending());
    return tableAreaService.listByBranch(orgId, branchId, normalized).map(this::toResponse);
  }

  @GetMapping("/{tableAreaId}")
  public TableAreaResponse get(
      @PathVariable UUID orgId, @PathVariable UUID branchId, @PathVariable UUID tableAreaId) {
    return toResponse(tableAreaService.require(orgId, tableAreaId));
  }

  @PatchMapping("/{tableAreaId}")
  public TableAreaResponse update(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @PathVariable UUID tableAreaId,
      @Valid @RequestBody TableAreaUpdateRequest request) {
    TableArea updated = tableAreaService.update(orgId, tableAreaId, request.name());
    return toResponse(updated);
  }

  private TableAreaResponse toResponse(TableArea area) {
    return new TableAreaResponse(
        area.getId(),
        area.getOrg().getId(),
        area.getBranch().getId(),
        area.getName(),
        area.getCreatedAt());
  }
}
