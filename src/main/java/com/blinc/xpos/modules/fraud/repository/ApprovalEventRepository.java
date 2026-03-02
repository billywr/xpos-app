package com.blinc.xpos.modules.fraud.repository;

import com.blinc.xpos.modules.fraud.domain.ApprovalEvent;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApprovalEventRepository extends JpaRepository<ApprovalEvent, UUID> {

  @Query(
      """
      select e from ApprovalEvent e
      where e.id = :id and e.org.id = :orgId
      """)
  Optional<ApprovalEvent> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select e from ApprovalEvent e
      where e.org.id = :orgId and e.branch.id = :branchId
      order by e.approvedAt desc
      """)
  Page<ApprovalEvent> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);
}
