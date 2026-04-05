package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.api.v1.operator.dto.TableEntityListResponse;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.blinc.xpos.modules.sales.domain.TableEntity;
import com.blinc.xpos.modules.sales.service.TableEntityService;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only operator API for listing tables in a branch (e.g. Select Table on POS). */
@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/tables")
public class TableOperatorController {

  private final TableEntityService tableEntityService;
  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public TableOperatorController(
      TableEntityService tableEntityService,
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.tableEntityService = Objects.requireNonNull(tableEntityService, "tableEntityService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @GetMapping
  public List<TableEntityListResponse> list(@PathVariable UUID orgId, @PathVariable UUID branchId) {
    staffAuthorizationService.requireStaffUser(orgId, principalResolver.require().iamUserId());
    var pageable = PageRequest.of(0, 500, Sort.by("name").ascending());
    return tableEntityService.listByBranch(orgId, branchId, pageable).stream()
        .map(this::toListResponse)
        .toList();
  }

  private TableEntityListResponse toListResponse(TableEntity entity) {
    return new TableEntityListResponse(
        entity.getId(),
        entity.getTableArea() != null ? entity.getTableArea().getId() : null,
        entity.getName(),
        entity.getCapacity(),
        entity.getStatus());
  }
}
