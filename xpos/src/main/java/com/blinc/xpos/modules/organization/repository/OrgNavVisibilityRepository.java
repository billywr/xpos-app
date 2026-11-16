package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.modules.organization.domain.OrgNavVisibility;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrgNavVisibilityRepository extends JpaRepository<OrgNavVisibility, UUID> {

  @Query(
      """
      select o from OrgNavVisibility o
      where o.org.id = :orgId and o.scope = :scope
      """)
  Optional<OrgNavVisibility> findByOrgIdAndScope(
      @Param("orgId") UUID orgId, @Param("scope") String scope);
}
