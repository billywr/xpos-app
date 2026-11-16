package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.ReceiptBlockAllocation;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReceiptBlockAllocationRepository
    extends JpaRepository<ReceiptBlockAllocation, UUID> {}
