package com.blinc.xpos;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import java.util.List;
import java.util.Map;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

public final class TestJwtFactory {

  private TestJwtFactory() {}

  public static JwtRequestPostProcessor adminJwt() {
    return jwt()
        .jwt(
            j ->
                j.subject("admin")
                    .claim("preferred_username", "admin")
                    .claim("realm_access", Map.of("roles", List.of("xpos-admin"))))
        .authorities(new SimpleGrantedAuthority("ROLE_xpos-admin"));
  }

  public static JwtRequestPostProcessor operatorJwt() {
    return jwt()
        .jwt(
            j ->
                j.subject("operator")
                    .claim("preferred_username", "operator")
                    .claim("realm_access", Map.of("roles", List.of("xpos-operator"))))
        .authorities(new SimpleGrantedAuthority("ROLE_xpos-operator"));
  }

  public static JwtRequestPostProcessor allRolesJwt() {
    return jwt()
        .jwt(
            j ->
                j.subject("admin")
                    .claim("preferred_username", "admin")
                    .claim("realm_access", Map.of("roles", List.of("xpos-admin", "xpos-operator"))))
        .authorities(
            new SimpleGrantedAuthority("ROLE_xpos-admin"),
            new SimpleGrantedAuthority("ROLE_xpos-operator"));
  }

  public static JwtRequestPostProcessor noRoleJwt() {
    return jwt().jwt(j -> j.subject("norole").claim("preferred_username", "norole"));
  }
}
