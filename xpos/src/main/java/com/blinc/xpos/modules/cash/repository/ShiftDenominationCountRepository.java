package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.ShiftDenominationCount;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShiftDenominationCountRepository
    extends JpaRepository<ShiftDenominationCount, UUID> {}
