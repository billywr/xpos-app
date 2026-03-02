package com.blinc.xpos.common.security;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
public class CurrentPrincipalResolver {

  public CurrentPrincipal require() {
    CurrentPrincipal principal = resolve();
    if (principal == null) {
      throw new SecurityException("Missing principal");
    }
    return principal;
  }

  public CurrentPrincipal resolve() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (!(authentication instanceof JwtAuthenticationToken token)) {
      return null;
    }

    Jwt jwt = token.getToken();
    if (jwt == null) {
      return null;
    }

    String subject = jwt.getSubject();
    String username = jwt.getClaimAsString("preferred_username");
    if (username == null || username.isBlank()) {
      username = jwt.getClaimAsString("username");
    }

    Set<String> roles = extractRoles(token);

    String iamUserId = subject;
    return new CurrentPrincipal(iamUserId, subject, username, roles);
  }

  private Set<String> extractRoles(JwtAuthenticationToken token) {
    Set<String> roles = new HashSet<>();
    for (GrantedAuthority authority : token.getAuthorities()) {
      if (authority != null && authority.getAuthority() != null) {
        roles.add(authority.getAuthority());
      }
    }

    Jwt jwt = token.getToken();
    if (jwt != null) {
      Object realmAccess = jwt.getClaim("realm_access");
      if (realmAccess instanceof Map<?, ?> m) {
        Object rawRoles = m.get("roles");
        if (rawRoles instanceof Iterable<?> it) {
          for (Object r : it) {
            if (r != null) {
              roles.add(Objects.toString(r));
            }
          }
        }
      }
    }

    if (roles.isEmpty()) {
      return Collections.emptySet();
    }
    return Collections.unmodifiableSet(roles);
  }
}
