package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.modules.organization.domain.StaffProfile;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffProfileRepository extends JpaRepository<StaffProfile, UUID> {

  @Query(
      """
            select p
            from StaffProfile p
            where p.org.id = :orgId
              and p.staffUser.id = :staffUserId
            """)
  Optional<StaffProfile> findByOrgIdAndStaffUserId(
      @Param("orgId") UUID orgId, @Param("staffUserId") UUID staffUserId);
}
