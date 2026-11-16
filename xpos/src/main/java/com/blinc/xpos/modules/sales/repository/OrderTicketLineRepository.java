package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.OrderTicketLine;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderTicketLineRepository extends JpaRepository<OrderTicketLine, UUID> {}
