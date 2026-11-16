package com.blinc.xpos.modules.organization.service.impl;

import com.blinc.xpos.modules.organization.domain.Org;
import com.blinc.xpos.modules.organization.domain.OrgNavVisibility;
import com.blinc.xpos.modules.organization.repository.OrgNavVisibilityRepository;
import com.blinc.xpos.modules.organization.service.OrgNavVisibilityService;
import com.blinc.xpos.modules.organization.service.OrgService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.time.Clock;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrgNavVisibilityServiceImpl implements OrgNavVisibilityService {

  private static final String SCOPE_ADMIN = "admin";
  private static final String SCOPE_OPERATOR = "operator";
  private static final String SCOPE_HEADER = "header";
  private static final TypeReference<Map<String, Boolean>> MAP_TYPE =
      new TypeReference<Map<String, Boolean>>() {};
  private static final TypeReference<Map<String, String>> LABELS_MAP_TYPE =
      new TypeReference<Map<String, String>>() {};

  private final OrgNavVisibilityRepository repository;
  private final OrgService orgService;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public OrgNavVisibilityServiceImpl(
      OrgNavVisibilityRepository repository,
      OrgService orgService,
      ObjectMapper objectMapper,
      Clock clock) {
    this.repository = Objects.requireNonNull(repository, "repository");
    this.orgService = Objects.requireNonNull(orgService, "orgService");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.clock = Objects.requireNonNull(clock, "clock");
  }

  @Override
  @Transactional(readOnly = true)
  public Map<String, Boolean> getVisibility(UUID orgId, String scope) {
    validateScope(scope);
    orgService.require(orgId);
    return repository
        .findByOrgIdAndScope(orgId, scope)
        .map(this::jsonToMap)
        .orElse(Collections.emptyMap());
  }

  @Override
  @Transactional(readOnly = true)
  public Map<String, String> getLabels(UUID orgId, String scope) {
    validateScope(scope);
    orgService.require(orgId);
    return repository
        .findByOrgIdAndScope(orgId, scope)
        .map(this::labelsJsonToMap)
        .orElse(Collections.emptyMap());
  }

  @Override
  @Transactional
  public void saveVisibility(UUID orgId, String scope, Map<String, Boolean> visibility) {
    validateScope(scope);
    Org org = orgService.require(orgId);
    Map<String, Boolean> sanitized =
        visibility != null ? new HashMap<>(visibility) : Collections.emptyMap();

    OrgNavVisibility entity =
        repository.findByOrgIdAndScope(orgId, scope).orElseGet(() -> createNew(org, scope));

    JsonNode json = objectMapper.valueToTree(sanitized);
    entity.setVisibilityJson(json);
    entity.setUpdatedAt(Instant.now(clock));
    repository.save(entity);
  }

  @Override
  @Transactional
  public void saveLabels(UUID orgId, String scope, Map<String, String> labels) {
    validateScope(scope);
    Org org = orgService.require(orgId);
    Map<String, String> sanitized = labels != null ? new HashMap<>(labels) : Collections.emptyMap();
    sanitized.entrySet().removeIf(e -> e.getValue() == null || e.getValue().isBlank());

    OrgNavVisibility entity =
        repository.findByOrgIdAndScope(orgId, scope).orElseGet(() -> createNew(org, scope));

    JsonNode json = objectMapper.valueToTree(sanitized);
    entity.setLabelsJson(json);
    entity.setUpdatedAt(Instant.now(clock));
    repository.save(entity);
  }

  @Override
  @Transactional(readOnly = true)
  public NavVisibilityDto getAll(UUID orgId) {
    orgService.require(orgId);
    Map<String, Boolean> admin = getVisibility(orgId, SCOPE_ADMIN);
    Map<String, Boolean> operator = getVisibility(orgId, SCOPE_OPERATOR);
    Map<String, Boolean> header = getVisibility(orgId, SCOPE_HEADER);
    Map<String, String> adminLabels = getLabels(orgId, SCOPE_ADMIN);
    Map<String, String> operatorLabels = getLabels(orgId, SCOPE_OPERATOR);
    Map<String, String> headerLabels = getLabels(orgId, SCOPE_HEADER);
    return new NavVisibilityDto(admin, operator, header, adminLabels, operatorLabels, headerLabels);
  }

  private OrgNavVisibility createNew(Org org, String scope) {
    OrgNavVisibility e = new OrgNavVisibility();
    e.setOrg(org);
    e.setScope(scope);
    e.setVisibilityJson(JsonNodeFactory.instance.objectNode());
    e.setLabelsJson(JsonNodeFactory.instance.objectNode());
    Instant now = Instant.now(clock);
    e.setCreatedAt(now);
    e.setUpdatedAt(now);
    return repository.save(e);
  }

  private Map<String, Boolean> jsonToMap(OrgNavVisibility entity) {
    JsonNode node = entity.getVisibilityJson();
    if (node == null || !node.isObject()) {
      return Collections.emptyMap();
    }
    try {
      Map<String, Boolean> map = objectMapper.convertValue(node, MAP_TYPE);
      return map != null ? map : Collections.emptyMap();
    } catch (Exception ex) {
      return Collections.emptyMap();
    }
  }

  private Map<String, String> labelsJsonToMap(OrgNavVisibility entity) {
    JsonNode node = entity.getLabelsJson();
    if (node == null || !node.isObject()) {
      return Collections.emptyMap();
    }
    try {
      Map<String, String> map = objectMapper.convertValue(node, LABELS_MAP_TYPE);
      return map != null ? map : Collections.emptyMap();
    } catch (Exception ex) {
      return Collections.emptyMap();
    }
  }

  private void validateScope(String scope) {
    if (!SCOPE_ADMIN.equals(scope)
        && !SCOPE_OPERATOR.equals(scope)
        && !SCOPE_HEADER.equals(scope)) {
      throw new IllegalArgumentException("Scope must be 'admin', 'operator', or 'header'");
    }
  }
}
