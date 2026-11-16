package com.blinc.xpos.modules.assistant.repository;

import com.blinc.xpos.modules.assistant.domain.InsightEvent;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InsightEventRepository extends JpaRepository<InsightEvent, UUID> {

  @Query(
      """
      select e from InsightEvent e
      where e.id = :id and e.org.id = :orgId
      """)
  Optional<InsightEvent> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select e from InsightEvent e
      where e.org.id = :orgId and e.branch.id = :branchId
      and e.acknowledgedAt is null
      order by e.createdAt desc
      """)
  Page<InsightEvent> findUnacknowledgedByOrgAndBranch(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select count(e) from InsightEvent e
      where e.org.id = :orgId and e.branch.id = :branchId
      and e.acknowledgedAt is null
      """)
  long countUnacknowledgedByOrgAndBranch(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);
}
