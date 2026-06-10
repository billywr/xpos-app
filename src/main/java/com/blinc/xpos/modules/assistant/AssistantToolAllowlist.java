package com.blinc.xpos.modules.assistant;

import java.util.EnumSet;
import java.util.Set;

/** Role-based allowlist for assistant tools. */
public final class AssistantToolAllowlist {

  private static final Set<AssistantIntent> ADMIN_ONLY = EnumSet.of(AssistantIntent.CATALOG_COUNT);

  private AssistantToolAllowlist() {}

  public static boolean isAllowed(AssistantIntent intent, boolean adminAccess) {
    if (ADMIN_ONLY.contains(intent)) {
      return adminAccess;
    }
    return intent != AssistantIntent.UNKNOWN;
  }
}
