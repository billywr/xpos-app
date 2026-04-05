package com.blinc.xpos.api.v1.admin.staff;

import com.blinc.xpos.api.v1.admin.staff.dto.StaffBranchAssignmentCreateRequest;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffBranchAssignmentResponse;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffProfileResponse;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffProfileUpsertRequest;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffUserCreateRequest;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffUserResponse;
import com.blinc.xpos.api.v1.admin.staff.dto.StaffUserStatusUpdateRequest;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.organization.domain.StaffBranchAssignment;
import com.blinc.xpos.modules.organization.domain.StaffProfile;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.StaffBranchAssignmentService;
import com.blinc.xpos.modules.organization.service.StaffProfileService;
import com.blinc.xpos.modules.organization.service.StaffUserService;
import jakarta.validation.Valid;
import java.util.List;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/staff-users")
public class StaffAdminController {

  private final StaffUserService staffUserService;
  private final StaffProfileService staffProfileService;
  private final StaffBranchAssignmentService assignmentService;
  private final PageRequestFactory pageRequestFactory;

  public StaffAdminController(
      StaffUserService staffUserService,
      StaffProfileService staffProfileService,
      StaffBranchAssignmentService assignmentService,
      PageRequestFactory pageRequestFactory) {
    this.staffUserService = Objects.requireNonNull(staffUserService, "staffUserService");
    this.staffProfileService = Objects.requireNonNull(staffProfileService, "staffProfileService");
    this.assignmentService = Objects.requireNonNull(assignmentService, "assignmentService");
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory, "pageRequestFactory");
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public StaffUserResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody StaffUserCreateRequest request) {
    StaffUser created = staffUserService.create(orgId, request.iamUserId(), request.username());
    return toResponse(created);
  }

  @GetMapping
  public Page<StaffUserResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized = pageRequestFactory.normalize(pageable, Sort.by("createdAt").descending());
    return staffUserService.list(orgId, normalized).map(this::toResponse);
  }

  @GetMapping("/{staffUserId}")
  public StaffUserResponse get(@PathVariable UUID orgId, @PathVariable UUID staffUserId) {
    return toResponse(staffUserService.require(orgId, staffUserId));
  }

  @PatchMapping("/{staffUserId}/status")
  public StaffUserResponse updateStatus(
      @PathVariable UUID orgId,
      @PathVariable UUID staffUserId,
      @Valid @RequestBody StaffUserStatusUpdateRequest request) {
    StaffUser updated = staffUserService.updateStatus(orgId, staffUserId, request.status());
    return toResponse(updated);
  }

  @DeleteMapping("/{staffUserId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID orgId, @PathVariable UUID staffUserId) {
    staffUserService.softDelete(orgId, staffUserId);
  }

  @PutMapping("/{staffUserId}/profile")
  public StaffProfileResponse upsertProfile(
      @PathVariable UUID orgId,
      @PathVariable UUID staffUserId,
      @Valid @RequestBody StaffProfileUpsertRequest request) {
    StaffProfile profile =
        staffProfileService.upsert(
            orgId,
            staffUserId,
            request.displayName(),
            request.phone(),
            request.email(),
            request.employeeNo(),
            request.defaultBranchId(),
            request.status());
    return toProfileResponse(profile);
  }

  @GetMapping("/{staffUserId}/profile")
  public StaffProfileResponse getProfile(@PathVariable UUID orgId, @PathVariable UUID staffUserId) {
    return toProfileResponse(staffProfileService.require(orgId, staffUserId));
  }

  @PostMapping("/{staffUserId}/branches")
  @ResponseStatus(HttpStatus.CREATED)
  public StaffBranchAssignmentResponse assignBranch(
      @PathVariable UUID orgId,
      @PathVariable UUID staffUserId,
      @Valid @RequestBody StaffBranchAssignmentCreateRequest request) {
    StaffBranchAssignment assignment =
        assignmentService.assign(orgId, staffUserId, request.branchId(), request.primary());
    return toAssignmentResponse(assignment);
  }

  @GetMapping("/{staffUserId}/branches")
  public List<StaffBranchAssignmentResponse> listAssignments(
      @PathVariable UUID orgId,
      @PathVariable UUID staffUserId,
      @RequestParam(name = "includeBranch", defaultValue = "false") boolean includeBranch) {
    return assignmentService.list(orgId, staffUserId).stream()
        .map(a -> toAssignmentResponse(a))
        .toList();
  }

  private StaffUserResponse toResponse(StaffUser staffUser) {
    return new StaffUserResponse(
        staffUser.getId(),
        staffUser.getOrg().getId(),
        staffUser.getIamUserId(),
        staffUser.getUsername(),
        staffUser.getStatus(),
        staffUser.getCreatedAt(),
        staffUser.getUpdatedAt());
  }

  private StaffProfileResponse toProfileResponse(StaffProfile profile) {
    return new StaffProfileResponse(
        profile.getId(),
        profile.getOrg().getId(),
        profile.getStaffUser().getId(),
        profile.getDisplayName(),
        profile.getPhone(),
        profile.getEmail(),
        profile.getEmployeeNo(),
        profile.getDefaultBranch() == null ? null : profile.getDefaultBranch().getId(),
        profile.getStatus(),
        profile.getCreatedAt(),
        profile.getUpdatedAt());
  }

  private StaffBranchAssignmentResponse toAssignmentResponse(StaffBranchAssignment assignment) {
    return new StaffBranchAssignmentResponse(
        assignment.getId(),
        assignment.getOrg().getId(),
        assignment.getStaffUser().getId(),
        assignment.getBranch().getId(),
        Boolean.TRUE.equals(assignment.getIsPrimary()),
        assignment.getCreatedAt());
  }
}
