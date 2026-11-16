package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.PaymentReference;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentReferenceRepository extends JpaRepository<PaymentReference, UUID> {}
