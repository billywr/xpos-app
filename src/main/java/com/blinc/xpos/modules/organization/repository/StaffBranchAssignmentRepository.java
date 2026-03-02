package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.modules.organization.domain.StaffBranchAssignment;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffBranchAssignmentRepository
    extends JpaRepository<StaffBranchAssignment, UUID> {

  @Query(
      """
            select a
            from StaffBranchAssignment a
            where a.org.id = :orgId
              and a.staffUser.id = :staffUserId
            order by a.createdAt asc
            """)
  List<StaffBranchAssignment> findAllByOrgIdAndStaffUserId(
      @Param("orgId") UUID orgId, @Param("staffUserId") UUID staffUserId);

  @Query(
      """
            select a
            from StaffBranchAssignment a
            where a.org.id = :orgId
              and a.staffUser.id = :staffUserId
              and a.branch.id = :branchId
            """)
  Optional<StaffBranchAssignment> findByOrgIdAndStaffUserIdAndBranchId(
      @Param("orgId") UUID orgId,
      @Param("staffUserId") UUID staffUserId,
      @Param("branchId") UUID branchId);

  @Query(
      """
            select a
            from StaffBranchAssignment a
            where a.org.id = :orgId
              and a.staffUser.id = :staffUserId
              and a.isPrimary = true
            """)
  Optional<StaffBranchAssignment> findPrimaryByOrgIdAndStaffUserId(
      @Param("orgId") UUID orgId, @Param("staffUserId") UUID staffUserId);

  @Query(
      """
            select a
            from StaffBranchAssignment a
            where a.branch.id = :branchId
              and a.staffUser.iamUserId = :iamUserId
            """)
  Optional<StaffBranchAssignment> findByBranchIdAndStaffUserIamUserId(
      @Param("branchId") UUID branchId, @Param("iamUserId") String iamUserId);
}
