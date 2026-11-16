package com.blinc.xpos.modules.cash.repository;

import com.blinc.xpos.modules.cash.domain.ZReport;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ZReportRepository extends JpaRepository<ZReport, UUID> {}
