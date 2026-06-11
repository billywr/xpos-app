package com.blinc.xpos.modules.mpesa.repository;

import com.blinc.xpos.modules.mpesa.domain.MpesaStkRequest;
import com.blinc.xpos.modules.mpesa.domain.MpesaStkStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MpesaStkRequestRepository extends JpaRepository<MpesaStkRequest, UUID> {

  @Query(
      """
      select r from MpesaStkRequest r
      left join fetch r.org
      left join fetch r.branch
      left join fetch r.terminal
      left join fetch r.sale
      left join fetch r.staffUser
      left join fetch r.tender
      where r.org.id = :orgId and r.id = :requestId
      """)
  Optional<MpesaStkRequest> findByIdAndOrgId(
      @Param("orgId") UUID orgId, @Param("requestId") UUID requestId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      """
      select r from MpesaStkRequest r
      left join fetch r.org
      left join fetch r.branch
      left join fetch r.terminal
      left join fetch r.sale s
      left join fetch s.branch
      left join fetch r.staffUser
      where r.checkoutRequestId = :checkoutRequestId
      """)
  Optional<MpesaStkRequest> findByCheckoutRequestIdForUpdate(
      @Param("checkoutRequestId") String checkoutRequestId);

  @Query(
      """
      select count(r) > 0 from MpesaStkRequest r
      where r.sale.id = :saleId and r.status = :status
      """)
  boolean existsBySaleIdAndStatus(
      @Param("saleId") UUID saleId, @Param("status") MpesaStkStatus status);

  @Query(
      """
      select r from MpesaStkRequest r
      where r.status = :status and r.createdAt < :cutoff
      """)
  List<MpesaStkRequest> findPendingOlderThan(
      @Param("status") MpesaStkStatus status, @Param("cutoff") Instant cutoff);
}
