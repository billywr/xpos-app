package com.blinc.xpos.modules.assistant.job;

import com.blinc.xpos.modules.assistant.service.InsightEvaluationService;
import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.repository.OrgRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Scheduled rule-based insight evaluation (proactive alerts, zero LLM). */
@Component
@ConditionalOnProperty(
    name = "xpos.assistant.insights.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class InsightEvaluationJob {

  private static final Logger LOG = LoggerFactory.getLogger(InsightEvaluationJob.class);

  private final OrgRepository orgRepository;
  private final InsightEvaluationService insightEvaluationService;

  public InsightEvaluationJob(
      OrgRepository orgRepository, InsightEvaluationService insightEvaluationService) {
    this.orgRepository = orgRepository;
    this.insightEvaluationService = insightEvaluationService;
  }

  @Scheduled(cron = "${xpos.assistant.insights.cron:0 0 */4 * * *}")
  public void evaluateAllOrgs() {
    List<Org> orgs = orgRepository.findAll(PageRequest.of(0, 500)).getContent();
    for (Org org : orgs) {
      try {
        insightEvaluationService.evaluateOrg(org.getId());
      } catch (Exception ex) {
        LOG.warn("Insight evaluation failed for org {}: {}", org.getId(), ex.getMessage());
      }
    }
  }
}
