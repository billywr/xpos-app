package com.blinc.xpos.modules.ledger.repository;

import com.blinc.xpos.modules.ledger.domain.PostingRule;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostingRuleRepository extends JpaRepository<PostingRule, UUID> {

  @Query(
      """
      select r from PostingRule r
      where r.id = :id and r.org.id = :orgId
      """)
  Optional<PostingRule> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select r from PostingRule r
      where r.org.id = :orgId
      order by r.eventType
      """)
  Page<PostingRule> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select r from PostingRule r
      where r.org.id = :orgId and r.eventType = :eventType and r.active = true
      """)
  Optional<PostingRule> findActiveByOrgIdAndEventType(
      @Param("orgId") UUID orgId, @Param("eventType") String eventType);
}
