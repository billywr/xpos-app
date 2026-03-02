package com.blinc.xpos.modules.ledger.repository;

import com.blinc.xpos.modules.ledger.domain.LedgerEntry;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {

  @Query(
      """
      select e from LedgerEntry e
      where e.id = :id and e.org.id = :orgId
      """)
  Optional<LedgerEntry> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select e from LedgerEntry e
      where e.org.id = :orgId
      order by e.createdAt desc
      """)
  Page<LedgerEntry> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select e from LedgerEntry e
      where e.org.id = :orgId and e.branch.id = :branchId
      order by e.createdAt desc
      """)
  Page<LedgerEntry> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select e from LedgerEntry e
      where e.org.id = :orgId and e.branch.id = :branchId and e.businessDate = :businessDate
      order by e.createdAt desc
      """)
  Page<LedgerEntry> findAllByOrgIdAndBranchIdAndBusinessDate(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("businessDate") LocalDate businessDate,
      Pageable pageable);
}
