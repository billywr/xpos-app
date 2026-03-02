package com.blinc.xpos.api.v1.me;

import com.blinc.xpos.api.v1.me.dto.MeResponse;
import com.blinc.xpos.api.v1.me.dto.MeStaffProfileResponse;
import com.blinc.xpos.common.security.CurrentPrincipal;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.organization.domain.Branch;
import com.blinc.xpos.modules.organization.domain.StaffProfile;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import jakarta.validation.constraints.NotNull;
import java.util.Objects;
import java.util.UUID;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Validated
public class MeController {

  private final CurrentPrincipalResolver principalResolver;
  private final StaffAuthorizationService staffAuthorizationService;

  public MeController(
      CurrentPrincipalResolver principalResolver,
      StaffAuthorizationService staffAuthorizationService) {
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
  }

  @GetMapping
  public MeResponse me(@RequestParam("orgId") @NotNull UUID orgId) {
    CurrentPrincipal principal = principalResolver.require();

    StaffUser staffUser = staffAuthorizationService.requireStaffUser(orgId, principal.iamUserId());
    StaffProfile profile = staffAuthorizationService.findProfile(orgId, staffUser.getId());
    Branch primaryBranch = staffAuthorizationService.findPrimaryBranch(orgId, staffUser.getId());

    return new MeResponse(
        orgId,
        principal.iamUserId(),
        principal.username(),
        staffUser.getId(),
        staffUser.getStatus(),
        profile == null ? null : toProfile(profile),
        primaryBranch == null ? null : primaryBranch.getId());
  }

  private static MeStaffProfileResponse toProfile(StaffProfile profile) {
    return new MeStaffProfileResponse(
        profile.getDisplayName(),
        profile.getPhone(),
        profile.getEmail(),
        profile.getEmployeeNo(),
        profile.getDefaultBranch() == null ? null : profile.getDefaultBranch().getId(),
        profile.getStatus());
  }
}
