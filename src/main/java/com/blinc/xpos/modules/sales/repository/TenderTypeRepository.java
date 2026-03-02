package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.TenderType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenderTypeRepository extends JpaRepository<TenderType, UUID> {

  @Query(
      """
      select t from TenderType t
      where t.org.id = :orgId and t.active = true
      order by t.code
      """)
  List<TenderType> findByOrgIdAndActiveTrue(@Param("orgId") UUID orgId);

  @Query(
      """
      select t from TenderType t
      where t.id = :id and t.org.id = :orgId
      """)
  Optional<TenderType> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select t from TenderType t
      where t.org.id = :orgId
      order by t.code
      """)
  List<TenderType> findAllByOrgIdOrderByCode(@Param("orgId") UUID orgId);
}
