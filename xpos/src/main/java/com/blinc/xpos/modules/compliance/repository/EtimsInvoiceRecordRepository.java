package com.blinc.xpos.modules.compliance.repository;

import com.blinc.xpos.modules.compliance.domain.EtimsInvoiceRecord;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EtimsInvoiceRecordRepository extends JpaRepository<EtimsInvoiceRecord, UUID> {

  @Query(
      """
      select e from EtimsInvoiceRecord e
      where e.id = :id and e.org.id = :orgId
      """)
  Optional<EtimsInvoiceRecord> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select e from EtimsInvoiceRecord e
      where e.org.id = :orgId and e.branch.id = :branchId
      order by e.createdAt desc
      """)
  Page<EtimsInvoiceRecord> findAllByOrgIdAndBranchId(
      @Param("orgId") UUID orgId, @Param("branchId") UUID branchId, Pageable pageable);

  @Query(
      """
      select e from EtimsInvoiceRecord e
      where e.org.id = :orgId and e.sale.id = :saleId
      """)
  Optional<EtimsInvoiceRecord> findByOrgIdAndSaleId(
      @Param("orgId") UUID orgId, @Param("saleId") UUID saleId);
}
