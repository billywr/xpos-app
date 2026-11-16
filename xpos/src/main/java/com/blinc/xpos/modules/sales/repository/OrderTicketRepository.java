package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.OrderTicket;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderTicketRepository extends JpaRepository<OrderTicket, UUID> {}
