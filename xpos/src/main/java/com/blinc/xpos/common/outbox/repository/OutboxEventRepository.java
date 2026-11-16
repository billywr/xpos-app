package com.blinc.xpos.common.outbox.repository;

import com.blinc.xpos.common.constants.enums.OutboxStatus;
import com.blinc.xpos.common.outbox.domain.OutboxEvent;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

  @Query(
      """
      select e from OutboxEvent e
      where e.id = :id and e.org.id = :orgId
      """)
  Optional<OutboxEvent> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select e from OutboxEvent e
      where e.org.id = :orgId
      order by e.createdAt desc
      """)
  Page<OutboxEvent> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select e from OutboxEvent e
      where e.status = :status
      order by e.createdAt asc
      """)
  Page<OutboxEvent> findByStatusOrderByCreatedAtAsc(
      @Param("status") OutboxStatus status, Pageable pageable);
}
