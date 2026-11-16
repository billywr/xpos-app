package com.blinc.xpos.modules.pricing.repository;

import com.blinc.xpos.modules.pricing.domain.PriceList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PriceListRepository extends JpaRepository<PriceList, UUID> {

  @Query("""
      select p from PriceList p
      where p.id = :id and p.org.id = :orgId
      """)
  Optional<PriceList> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query("""
      select p from PriceList p
      where p.org.id = :orgId
      """)
  Page<PriceList> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select p from PriceList p
      where p.org.id = :orgId and p.active = true
      """)
  Page<PriceList> findAllByOrgIdAndActiveTrue(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select p from PriceList p
      where p.org.id = :orgId and (p.branch is null or p.branch.id = :branchId)
      and p.active = true
      order by p.priority desc, p.createdAt
      """)
  List<PriceList> findActiveByOrgIdAndBranchIdOrderByPriorityDesc(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId);
}
