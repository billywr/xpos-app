package com.blinc.xpos.config.security;

import java.util.Objects;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(XposSecurityProperties.class)
public class SecurityConfig {

  private final KeycloakJwtAuthenticationConverter keycloakJwtAuthenticationConverter;
  private final XposSecurityProperties securityProperties;

  public SecurityConfig(
      KeycloakJwtAuthenticationConverter keycloakJwtAuthenticationConverter,
      XposSecurityProperties securityProperties) {
    this.keycloakJwtAuthenticationConverter =
        Objects.requireNonNull(keycloakJwtAuthenticationConverter);
    this.securityProperties = Objects.requireNonNull(securityProperties);
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    String adminRole = securityProperties.getRoles().getAdmin();
    String operatorRole = securityProperties.getRoles().getOperator();

    http.csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/api/v1/health/**", "/actuator/health/**", "/actuator/info")
                    .permitAll()
                    .requestMatchers("/uploads/**")
                    .permitAll()
                    .requestMatchers("/api/v1/admin/**")
                    .hasAnyRole(adminRole, operatorRole)
                    .requestMatchers("/api/v1/operator/**")
                    .hasAnyRole(adminRole, operatorRole)
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(
            oauth2 ->
                oauth2.jwt(
                    jwt -> jwt.jwtAuthenticationConverter(keycloakJwtAuthenticationConverter)));

    return http.build();
  }
}
