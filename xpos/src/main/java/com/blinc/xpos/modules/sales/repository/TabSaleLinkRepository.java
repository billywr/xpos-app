package com.blinc.xpos.modules.sales.repository;

import com.blinc.xpos.modules.sales.domain.TabSaleLink;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TabSaleLinkRepository extends JpaRepository<TabSaleLink, UUID> {}
