package com.blinc.xpos.modules.organization.service;

import java.util.Map;
import java.util.UUID;

public interface OrgNavVisibilityService {

  /**
   * Returns visibility map for a scope. Empty map means all visible (default).
   */
  Map<String, Boolean> getVisibility(UUID orgId, String scope);

  /**
   * Returns custom labels for a scope. Path -> label. Empty/blank = use default.
   */
  Map<String, String> getLabels(UUID orgId, String scope);

  /**
   * Saves visibility for a scope. Empty map means show all (reset to defaults).
   */
  void saveVisibility(UUID orgId, String scope, Map<String, Boolean> visibility);

  /**
   * Saves custom labels for a scope. Blank values are removed.
   */
  void saveLabels(UUID orgId, String scope, Map<String, String> labels);

  /**
   * Returns both admin and operator visibility and labels in one call.
   */
  NavVisibilityDto getAll(UUID orgId);

  record NavVisibilityDto(
      Map<String, Boolean> admin,
      Map<String, Boolean> operator,
      Map<String, Boolean> header,
      Map<String, String> adminLabels,
      Map<String, String> operatorLabels,
      Map<String, String> headerLabels) {}
}
