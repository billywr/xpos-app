package com.blinc.xpos.api.v1.admin.organization;

import com.blinc.xpos.api.v1.admin.organization.dto.NavVisibilityResponse;
import com.blinc.xpos.api.v1.admin.organization.dto.NavVisibilityUpdateRequest;
import com.blinc.xpos.modules.organization.service.OrgNavVisibilityService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/nav-visibility")
public class NavVisibilityAdminController {

  private final OrgNavVisibilityService navVisibilityService;

  public NavVisibilityAdminController(OrgNavVisibilityService navVisibilityService) {
    this.navVisibilityService = Objects.requireNonNull(navVisibilityService, "navVisibilityService");
  }

  @GetMapping
  public NavVisibilityResponse get(@PathVariable UUID orgId) {
    var dto = navVisibilityService.getAll(orgId);
    return new NavVisibilityResponse(
        dto.admin(),
        dto.operator(),
        dto.header(),
        dto.adminLabels(),
        dto.operatorLabels(),
        dto.headerLabels());
  }

  @PutMapping
  public NavVisibilityResponse update(
      @PathVariable UUID orgId, @RequestBody NavVisibilityUpdateRequest request) {
    navVisibilityService.saveVisibility(orgId, "admin", request.admin());
    navVisibilityService.saveVisibility(orgId, "operator", request.operator());
    navVisibilityService.saveVisibility(orgId, "header", request.header());
    navVisibilityService.saveLabels(orgId, "admin", request.adminLabels());
    navVisibilityService.saveLabels(orgId, "operator", request.operatorLabels());
    navVisibilityService.saveLabels(orgId, "header", request.headerLabels());
    var dto = navVisibilityService.getAll(orgId);
    return new NavVisibilityResponse(
        dto.admin(),
        dto.operator(),
        dto.header(),
        dto.adminLabels(),
        dto.operatorLabels(),
        dto.headerLabels());
  }
}
