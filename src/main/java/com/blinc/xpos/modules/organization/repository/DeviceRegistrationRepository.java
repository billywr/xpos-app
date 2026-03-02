package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.DeviceRegistration;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeviceRegistrationRepository extends JpaRepository<DeviceRegistration, UUID> {

  @Query(
      """
select d
            from DeviceRegistration d
            where d.id = :id
              and d.org.id = :orgId
            """)
  Optional<DeviceRegistration> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
select d
            from DeviceRegistration d
            where d.org.id = :orgId
              and d.deviceId = :deviceId
            """)
  Optional<DeviceRegistration> findByOrgIdAndDeviceId(
      @Param("orgId") UUID orgId, @Param("deviceId") String deviceId);

  @Query("""
      select d from DeviceRegistration d
      where d.org.id = :orgId and d.status in :statuses
      """)
  Page<DeviceRegistration> findAllByOrgIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("statuses") Collection<StatusCommon> statuses,
      Pageable pageable);
}
