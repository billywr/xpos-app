package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.ReceiptSequence;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReceiptSequenceRepository extends JpaRepository<ReceiptSequence, UUID> {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      """
      select r from ReceiptSequence r
      where r.branch.id = :branchId and r.businessDate = :businessDate
        and ((r.terminal is null and :terminalId is null) or (r.terminal.id = :terminalId))
      """)
  Optional<ReceiptSequence> findByBranchIdAndTerminalIdAndBusinessDate(
      @Param("branchId") UUID branchId,
      @Param("terminalId") UUID terminalId,
      @Param("businessDate") LocalDate businessDate);

  @Query(
      """
      select r from ReceiptSequence r
      where r.id = :id and r.org.id = :orgId
      """)
  Optional<ReceiptSequence> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);
}
