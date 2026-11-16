package com.blinc.xpos.config.web;

import java.util.Objects;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

  private final XposCorsProperties props;

  public CorsConfig(XposCorsProperties props) {
    this.props = Objects.requireNonNull(props, "props");
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration cfg = new CorsConfiguration();
    cfg.setAllowCredentials(props.isAllowCredentials());
    cfg.setAllowedOrigins(props.getAllowedOrigins());
    cfg.setAllowedMethods(props.getAllowedMethods());
    cfg.setAllowedHeaders(props.getAllowedHeaders());
    cfg.setExposedHeaders(props.getExposedHeaders());
    cfg.setMaxAge(props.getMaxAgeSeconds());

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    if (props.isEnabled()) {
      source.registerCorsConfiguration("/**", cfg);
    }
    return source;
  }
}
