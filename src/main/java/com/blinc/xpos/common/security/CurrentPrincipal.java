package com.blinc.xpos.common.security;

import java.util.Set;

public record CurrentPrincipal(
    String iamUserId, String subject, String username, Set<String> roles) {}
