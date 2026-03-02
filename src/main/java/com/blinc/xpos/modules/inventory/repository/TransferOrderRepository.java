package com.blinc.xpos.modules.inventory.repository;

import com.blinc.xpos.modules.inventory.domain.TransferOrder;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransferOrderRepository extends JpaRepository<TransferOrder, UUID> {

  @Query(
      """
      select t from TransferOrder t
      where t.id = :id and t.org.id = :orgId
      """)
  Optional<TransferOrder> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select t from TransferOrder t
      where t.org.id = :orgId
      """)
  Page<TransferOrder> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
