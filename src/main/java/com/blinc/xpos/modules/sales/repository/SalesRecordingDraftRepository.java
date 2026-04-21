package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.SalesRecordingDraft;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalesRecordingDraftRepository extends JpaRepository<SalesRecordingDraft, UUID> {

  @Query(
      value =
          """
      select * from sales_recording_draft d
      where d.org_id = :orgId
        and d.branch_id = :branchId
        and d.terminal_id = :terminalId
        and d.iam_user_id = CAST(:iamUserId AS text)
        and d.sale_date = :saleDate
      """,
      nativeQuery = true)
  Optional<SalesRecordingDraft> findDraft(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("terminalId") UUID terminalId,
      @Param("iamUserId") String iamUserId,
      @Param("saleDate") LocalDate saleDate);

  @Modifying
  @Query(
      value =
          """
      delete from sales_recording_draft d
      where d.org_id = :orgId
        and d.branch_id = :branchId
        and d.terminal_id = :terminalId
        and d.iam_user_id = CAST(:iamUserId AS text)
        and d.sale_date = :saleDate
      """,
      nativeQuery = true)
  void deleteDraft(
      @Param("orgId") UUID orgId,
      @Param("branchId") UUID branchId,
      @Param("terminalId") UUID terminalId,
      @Param("iamUserId") String iamUserId,
      @Param("saleDate") LocalDate saleDate);
}
