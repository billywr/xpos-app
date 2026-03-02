package com.blinc.xpos.config;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

/**
 * Test-only configuration that provides a {@link JwtDecoder} so the OAuth2 resource server
 * filter chain can load when issuer/jwk-set are not configured (e.g. integration tests).
 * Decoder returns a stub Jwt with subject "admin" and preferred_username "admin" for any
 * token, matching the typical {@code jwt().jwt(j -> j.subject("admin"))} usage in ITs.
 */
@TestConfiguration
public class TestJwtDecoderConfig {

  @Bean
  public JwtDecoder jwtDecoder() {
    return token ->
        Jwt.withTokenValue(token)
            .subject("admin")
            .claim("preferred_username", "admin")
            .build();
  }
}
