package com.blinc.xpos.api.v1.admin.ledger;

import com.blinc.xpos.api.v1.admin.ledger.dto.PostingRuleCreateRequest;
import com.blinc.xpos.api.v1.admin.ledger.dto.PostingRuleResponse;
import com.blinc.xpos.common.web.paging.PageRequestFactory;
import com.blinc.xpos.modules.ledger.domain.PostingRule;
import com.blinc.xpos.modules.ledger.service.PostingRuleService;
import jakarta.validation.Valid;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orgs/{orgId}/posting-rules")
public class PostingRuleAdminController {

  private final PostingRuleService postingRuleService;
  private final PageRequestFactory pageRequestFactory;

  public PostingRuleAdminController(
      PostingRuleService postingRuleService,
      PageRequestFactory pageRequestFactory) {
    this.postingRuleService = Objects.requireNonNull(postingRuleService);
    this.pageRequestFactory = Objects.requireNonNull(pageRequestFactory);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PostingRuleResponse create(
      @PathVariable UUID orgId, @Valid @RequestBody PostingRuleCreateRequest request) {
    PostingRule created =
        postingRuleService.create(
            orgId,
            request.eventType(),
            request.debitAccountCode(),
            request.creditAccountCode());
    return toResponse(created);
  }

  @GetMapping
  public Page<PostingRuleResponse> list(@PathVariable UUID orgId, Pageable pageable) {
    Pageable normalized =
        pageRequestFactory.normalize(pageable, Sort.by("eventType").ascending());
    return postingRuleService.list(orgId, normalized).map(PostingRuleAdminController::toResponse);
  }

  @GetMapping("/{ruleId}")
  public PostingRuleResponse get(
      @PathVariable UUID orgId, @PathVariable UUID ruleId) {
    return toResponse(postingRuleService.require(orgId, ruleId));
  }

  private static PostingRuleResponse toResponse(PostingRule r) {
    return new PostingRuleResponse(
        r.getId(),
        r.getOrg().getId(),
        r.getEventType(),
        r.getDebitAccountCode(),
        r.getCreditAccountCode(),
        r.getActive(),
        r.getCreatedAt(),
        r.getUpdatedAt());
  }
}
