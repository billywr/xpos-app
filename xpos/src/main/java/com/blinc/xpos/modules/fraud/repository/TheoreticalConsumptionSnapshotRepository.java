package com.blinc.xpos.modules.fraud.repository;

import com.blinc.xpos.modules.fraud.domain.TheoreticalConsumptionSnapshot;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TheoreticalConsumptionSnapshotRepository
    extends JpaRepository<TheoreticalConsumptionSnapshot, UUID> {}
