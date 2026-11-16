package com.blinc.xpos.modules.assistant.repository;

import com.blinc.xpos.modules.assistant.domain.AssistantQueryLog;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssistantQueryLogRepository extends JpaRepository<AssistantQueryLog, UUID> {

  @Query(
      """
      select l from AssistantQueryLog l
      where l.org.id = :orgId and l.requestId = :requestId
      """)
  Optional<AssistantQueryLog> findByOrgIdAndRequestId(
      @Param("orgId") UUID orgId, @Param("requestId") String requestId);

  @Query(
      """
      select l from AssistantQueryLog l
      where l.org.id = :orgId and l.createdAt >= :from and l.createdAt < :to
      order by l.createdAt desc
      """)
  Page<AssistantQueryLog> findByOrgIdAndCreatedAtBetween(
      @Param("orgId") UUID orgId,
      @Param("from") Instant from,
      @Param("to") Instant to,
      Pageable pageable);

  @Query(
      """
      select l.intent, count(l) from AssistantQueryLog l
      where l.org.id = :orgId and l.createdAt >= :from and l.createdAt < :to
      group by l.intent
      order by count(l) desc
      """)
  List<Object[]> countByIntentSince(
      @Param("orgId") UUID orgId, @Param("from") Instant from, @Param("to") Instant to);

  @Query(
      """
      select coalesce(sum(l.llmTokens), 0) from AssistantQueryLog l
      where l.org.id = :orgId and l.createdAt >= :from and l.createdAt < :to
      """)
  long sumLlmTokensSince(
      @Param("orgId") UUID orgId, @Param("from") Instant from, @Param("to") Instant to);
}
