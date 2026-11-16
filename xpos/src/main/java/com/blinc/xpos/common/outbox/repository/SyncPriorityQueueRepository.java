package com.blinc.xpos.common.outbox.repository;

import com.blinc.xpos.common.outbox.domain.SyncPriorityQueue;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SyncPriorityQueueRepository extends JpaRepository<SyncPriorityQueue, UUID> {}
