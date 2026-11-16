package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.SaleDiscountLine;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleDiscountLineRepository extends JpaRepository<SaleDiscountLine, UUID> {}
