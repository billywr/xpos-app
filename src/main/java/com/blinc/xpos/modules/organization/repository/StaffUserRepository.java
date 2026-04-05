package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.common.constants.enums.StatusCommon;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffUserRepository extends JpaRepository<StaffUser, UUID> {

  @Query(
      """
            select s
            from StaffUser s
            where s.id = :id
              and s.org.id = :orgId
            """)
  Optional<StaffUser> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
            select s
            from StaffUser s
            where s.org.id = :orgId
              and s.iamUserId = :iamUserId
            """)
  Optional<StaffUser> findByOrgIdAndIamUserId(
      @Param("orgId") UUID orgId, @Param("iamUserId") String iamUserId);

  @Query(
      """
            select s
            from StaffUser s
            where s.org.id = :orgId
              and s.username = :username
            """)
  Optional<StaffUser> findByOrgIdAndUsername(
      @Param("orgId") UUID orgId, @Param("username") String username);

  @Query(
      """
      select s from StaffUser s
      where s.org.id = :orgId and s.status in :statuses
      """)
  Page<StaffUser> findAllByOrgIdAndStatusIn(
      @Param("orgId") UUID orgId,
      @Param("statuses") Collection<StatusCommon> statuses,
      Pageable pageable);
}
