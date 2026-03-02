package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.Tab;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TabRepository extends JpaRepository<Tab, UUID> {}
