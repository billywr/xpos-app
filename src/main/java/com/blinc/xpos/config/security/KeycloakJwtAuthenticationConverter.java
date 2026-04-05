package com.blinc.xpos.config.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Maps Keycloak {@code realm_access.roles} JWT claim to Spring Security {@code ROLE_}-prefixed
 * granted authorities so that {@code hasRole("xpos-admin")} checks work in the security filter
 * chain.
 */
@Component
public class KeycloakJwtAuthenticationConverter
    implements Converter<Jwt, AbstractAuthenticationToken> {

  @Override
  public AbstractAuthenticationToken convert(Jwt jwt) {
    Collection<GrantedAuthority> authorities = extractAuthorities(jwt);
    return new JwtAuthenticationToken(jwt, authorities);
  }

  private Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
    List<GrantedAuthority> authorities = new ArrayList<>();

    Object realmAccess = jwt.getClaim("realm_access");
    if (realmAccess instanceof Map<?, ?> map) {
      Object roles = map.get("roles");
      if (roles instanceof Iterable<?> iterable) {
        for (Object role : iterable) {
          if (role != null) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
          }
        }
      }
    }

    return authorities;
  }
}
