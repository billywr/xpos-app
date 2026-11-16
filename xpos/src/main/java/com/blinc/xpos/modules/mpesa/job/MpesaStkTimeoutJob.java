package com.blinc.xpos.modules.mpesa.job;

import com.blinc.xpos.config.MpesaProperties;
import com.blinc.xpos.modules.mpesa.domain.MpesaStkRequest;
import com.blinc.xpos.modules.mpesa.domain.MpesaStkStatus;
import com.blinc.xpos.modules.mpesa.repository.MpesaStkRequestRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class MpesaStkTimeoutJob {

  private static final Logger log = LoggerFactory.getLogger(MpesaStkTimeoutJob.class);

  private final MpesaStkRequestRepository mpesaStkRequestRepository;
  private final MpesaProperties mpesaProperties;
  private final Clock clock;

  public MpesaStkTimeoutJob(
      MpesaStkRequestRepository mpesaStkRequestRepository,
      MpesaProperties mpesaProperties,
      Clock clock) {
    this.mpesaStkRequestRepository = Objects.requireNonNull(mpesaStkRequestRepository);
    this.mpesaProperties = Objects.requireNonNull(mpesaProperties);
    this.clock = Objects.requireNonNull(clock);
  }

  @Scheduled(fixedDelayString = "${xpos.mpesa.timeout-job-interval-ms:30000}")
  @Transactional
  public void markStalePendingAsTimeout() {
    Instant cutoff = Instant.now(clock).minusSeconds(mpesaProperties.getStkTimeoutSeconds());
    List<MpesaStkRequest> stale =
        mpesaStkRequestRepository.findPendingOlderThan(MpesaStkStatus.PENDING, cutoff);
    if (stale.isEmpty()) {
      return;
    }
    Instant now = Instant.now(clock);
    for (MpesaStkRequest request : stale) {
      request.setStatus(MpesaStkStatus.TIMEOUT);
      request.setResultDesc("STK push timed out waiting for customer PIN");
      request.setUpdatedAt(now);
    }
    mpesaStkRequestRepository.saveAll(stale);
    log.info("Marked {} M-Pesa STK request(s) as TIMEOUT", stale.size());
  }
}
