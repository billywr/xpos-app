package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.Receipt;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReceiptRepository extends JpaRepository<Receipt, UUID> {}
