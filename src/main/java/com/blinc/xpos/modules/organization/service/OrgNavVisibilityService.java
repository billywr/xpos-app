package com.blinc.xpos.modules.organization.service;

import java.util.Map;
import java.util.UUID;

public interface OrgNavVisibilityService {

  /**
   * Returns visibility map for a scope. Empty map means all visible (default).
   */
  Map<String, Boolean> getVisibility(UUID orgId, String scope);

  /**
   * Saves visibility for a scope. Empty map means show all (reset to defaults).
   */
  void saveVisibility(UUID orgId, String scope, Map<String, Boolean> visibility);

  /**
   * Returns both admin and operator visibility in one call.
   */
  NavVisibilityDto getAll(UUID orgId);

  record NavVisibilityDto(Map<String, Boolean> admin, Map<String, Boolean> operator) {}
}
