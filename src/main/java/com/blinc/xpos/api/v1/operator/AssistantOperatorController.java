package com.blinc.xpos.api.v1.operator;

import com.blinc.xpos.common.error.BadRequestException;
import com.blinc.xpos.common.security.CurrentPrincipalResolver;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryContext;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryRequest;
import com.blinc.xpos.modules.assistant.dto.AssistantQueryResponse;
import com.blinc.xpos.modules.assistant.dto.AssistantRequestParser;
import com.blinc.xpos.modules.assistant.service.AssistantQueryService;
import com.blinc.xpos.modules.organization.domain.StaffUser;
import com.blinc.xpos.modules.organization.service.BranchService;
import com.blinc.xpos.modules.organization.service.StaffAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator/orgs/{orgId}/branches/{branchId}/assistant")
public class AssistantOperatorController {

  private static final int MAX_MESSAGE_LENGTH = 500;
  private static final String REQUEST_ID_HEADER = "X-Request-Id";

  private final AssistantQueryService assistantQueryService;
  private final StaffAuthorizationService staffAuthorizationService;
  private final BranchService branchService;
  private final CurrentPrincipalResolver principalResolver;
  private final ObjectMapper objectMapper;

  public AssistantOperatorController(
      AssistantQueryService assistantQueryService,
      StaffAuthorizationService staffAuthorizationService,
      BranchService branchService,
      CurrentPrincipalResolver principalResolver,
      ObjectMapper objectMapper) {
    this.assistantQueryService =
        Objects.requireNonNull(assistantQueryService, "assistantQueryService");
    this.staffAuthorizationService =
        Objects.requireNonNull(staffAuthorizationService, "staffAuthorizationService");
    this.branchService = Objects.requireNonNull(branchService, "branchService");
    this.principalResolver = Objects.requireNonNull(principalResolver, "principalResolver");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
  }

  @PostMapping("/query")
  public AssistantQueryResponse query(
      @PathVariable UUID orgId,
      @PathVariable UUID branchId,
      @RequestBody String rawBody,
      HttpServletRequest httpRequest) {
    JsonNode bodyNode = parseBody(rawBody);
    AssistantQueryRequest request = AssistantRequestParser.parseRequest(objectMapper, bodyNode);
    requireValidMessage(request.message());

    StaffUser staff =
        staffAuthorizationService.requireStaffUserForBranch(
            orgId, branchId, principalResolver.require().iamUserId());
    var branch = branchService.require(orgId, branchId);
    var principal = principalResolver.require();
    String displayName =
        staff.getUsername() != null && !staff.getUsername().isBlank()
            ? staff.getUsername()
            : principal.username() != null && !principal.username().isBlank()
                ? principal.username()
                : principal.iamUserId();
    boolean adminAccess =
        principal.roles() != null && principal.roles().stream().anyMatch(r -> r.contains("admin"));
    String requestId = httpRequest.getHeader(REQUEST_ID_HEADER);
    if (requestId == null || requestId.isBlank()) {
      requestId = UUID.randomUUID().toString();
    }
    return assistantQueryService.query(
        new AssistantQueryContext(
            orgId,
            branchId,
            staff.getId(),
            displayName,
            principal.iamUserId(),
            branch.getName(),
            request.message(),
            requestId,
            request.screen(),
            request.filters(),
            adminAccess));
  }

  private JsonNode parseBody(String rawBody) {
    if (rawBody == null || rawBody.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "Request body is required.");
    }
    try {
      return objectMapper.readTree(rawBody);
    } catch (JsonProcessingException ex) {
      throw new BadRequestException("VALIDATION_ERROR", "Request body is not valid JSON.");
    }
  }

  private static void requireValidMessage(String message) {
    if (message == null || message.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "Message is required.");
    }
    if (message.length() > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
          "VALIDATION_ERROR", "Message must be at most " + MAX_MESSAGE_LENGTH + " characters.");
    }
  }
}
