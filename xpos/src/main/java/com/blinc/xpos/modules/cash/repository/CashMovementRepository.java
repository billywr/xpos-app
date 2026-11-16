package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.CashMovement;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CashMovementRepository extends JpaRepository<CashMovement, UUID> {

  @Query(
      """
      select m from CashMovement m
      where m.id = :id and m.org.id = :orgId
      """)
  Optional<CashMovement> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select m from CashMovement m
      where m.shift.id = :shiftId
      order by m.createdAt desc
      """)
  List<CashMovement> findAllByShiftId(@Param("shiftId") UUID shiftId);

  @Query(
      """
      select m from CashMovement m
      where m.branch.id = :branchId
      order by m.createdAt desc
      """)
  Page<CashMovement> findAllByBranchId(@Param("branchId") UUID branchId, Pageable pageable);
}
