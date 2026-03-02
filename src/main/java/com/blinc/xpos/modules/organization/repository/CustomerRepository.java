package com.blinc.xpos.modules.organization.repository;

import com.blinc.xpos.modules.organization.domain.Customer;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

  @Query(
      """
      select c from Customer c
      where c.id = :id and c.org.id = :orgId
      """)
  Optional<Customer> findByIdAndOrgId(@Param("id") UUID id, @Param("orgId") UUID orgId);

  @Query(
      """
      select c from Customer c
      where c.org.id = :orgId
      order by c.createdAt desc
      """)
  Page<Customer> findAllByOrgId(@Param("orgId") UUID orgId, Pageable pageable);
}
