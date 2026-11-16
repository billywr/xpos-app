package com.blinc.xpos.config;

import java.util.List;
import java.util.Map;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

/**
 * Test-only configuration that provides a {@link JwtDecoder} so the OAuth2 resource server filter
 * chain can load when issuer/jwk-set are not configured (e.g. integration tests). Decoder returns a
 * stub Jwt with subject "admin", preferred_username "admin", and both realm roles for any token.
 */
@TestConfiguration
public class TestJwtDecoderConfig {

  @Bean
  public JwtDecoder jwtDecoder() {
    return token ->
        Jwt.withTokenValue(token)
            .subject("admin")
            .claim("preferred_username", "admin")
            .claim("realm_access", Map.of("roles", List.of("xpos-admin", "xpos-operator")))
            .build();
  }
}
