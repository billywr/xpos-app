package com.blinc.xpos.common.web.filter;

import com.blinc.xpos.common.constants.HeaderNames;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Access logging filter that logs one structured line per HTTP request:
 *
 * <ul>
 *   <li>HTTP 2xx/3xx &rarr; INFO (app success)
 *   <li>HTTP 4xx &rarr; WARN (client error / bad request)
 *   <li>HTTP 5xx &rarr; ERROR (server error)
 * </ul>
 *
 * Actuator health checks and favicon requests are excluded to keep logs clean.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class ApiAccessLoggingFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(ApiAccessLoggingFilter.class);

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String uri = request.getRequestURI();
    return uri.startsWith("/actuator/health") || uri.startsWith("/favicon.ico");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    long startTime = System.currentTimeMillis();

    try {
      filterChain.doFilter(request, response);
    } finally {
      long duration = System.currentTimeMillis() - startTime;
      int status = response.getStatus();
      String method = request.getMethod();
      String uri = request.getRequestURI();
      String query = request.getQueryString();
      String path = (query != null && !query.isBlank()) ? uri + "?" + query : uri;

      String requestId = (String) request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
      if (requestId == null || requestId.isBlank()) {
        requestId = response.getHeader(HeaderNames.REQUEST_ID);
      }
      if (requestId == null || requestId.isBlank()) {
        requestId = "-";
      }

      if (status >= 500) {
        log.error("[HTTP] {} {} {} ({}ms) [reqId={}]", status, method, path, duration, requestId);
      } else if (status >= 400) {
        log.warn("[HTTP] {} {} {} ({}ms) [reqId={}]", status, method, path, duration, requestId);
      } else {
        log.info("[HTTP] {} {} {} ({}ms) [reqId={}]", status, method, path, duration, requestId);
      }
    }
  }
}
