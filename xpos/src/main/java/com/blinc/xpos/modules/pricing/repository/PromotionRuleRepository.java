package com.blinc.xpos.modules.pricing.repository;

import com.blinc.xpos.modules.pricing.domain.PromotionRule;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromotionRuleRepository extends JpaRepository<PromotionRule, UUID> {

  @Query(
      """
      select r from PromotionRule r
      where r.id = :id and r.org.id = :orgId
      """)
  Optional<PromotionRule> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query("""
      select r from PromotionRule r
      where r.org.id = :orgId
      """)
  Page<PromotionRule> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
