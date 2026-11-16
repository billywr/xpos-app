package com.blinc.xpos.modules.organization.service;

import com.blinc.xpos.api.v1.admin.organization.dto.OrgContextResponse;
import java.util.UUID;

/**
 * Returns a single aggregate of org-level reference data (branches, users, categories, tax, UoMs,
 * price lists, etc.) for admin/context loading.
 */
public interface OrgContextService {

  /**
   * Load org and all org-scoped reference data up to a bounded size per type.
   *
   * @param orgId organization id (must exist)
   * @return aggregate response with org and lists of reference entities
   */
  OrgContextResponse getContext(UUID orgId);
}
