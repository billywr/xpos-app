package com.blinc.xpos.modules.ledger.repository;

import com.blinc.xpos.modules.ledger.domain.LedgerAccount;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerAccountRepository extends JpaRepository<LedgerAccount, UUID> {

  @Query(
      """
      select a from LedgerAccount a
      where a.id = :id and a.org.id = :orgId
      """)
  Optional<LedgerAccount> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select a from LedgerAccount a
      where a.org.id = :orgId
      order by a.code
      """)
  Page<LedgerAccount> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);

  @Query(
      """
      select a from LedgerAccount a
      where a.org.id = :orgId and a.code = :code
      """)
  Optional<LedgerAccount> findByOrgIdAndCode(
      @Param("orgId") UUID orgId, @Param("code") String code);
}
