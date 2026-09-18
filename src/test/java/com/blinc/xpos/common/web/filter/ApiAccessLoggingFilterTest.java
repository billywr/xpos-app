package com.blinc.xpos.common.web.filter;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ApiAccessLoggingFilterTest {

  private final ApiAccessLoggingFilter filter = new ApiAccessLoggingFilter();

  @Test
  void filtersSuccessfulRequest() {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/orgs");
    request.setAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE, "req-123");
    MockHttpServletResponse response = new MockHttpServletResponse();
    response.setStatus(200);

    FilterChain chain = mock(FilterChain.class);

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
    assertDoesNotThrow(() -> verify(chain).doFilter(request, response));
  }

  @Test
  void filtersClientErrorRequest() {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth");
    request.setAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE, "req-456");
    MockHttpServletResponse response = new MockHttpServletResponse();
    response.setStatus(400);

    FilterChain chain = mock(FilterChain.class);

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
    assertDoesNotThrow(() -> verify(chain).doFilter(request, response));
  }

  @Test
  void filtersServerErrorRequest() {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/items");
    request.setQueryString("page=0&size=10");
    MockHttpServletResponse response = new MockHttpServletResponse();
    response.setStatus(500);

    FilterChain chain = mock(FilterChain.class);

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
    assertDoesNotThrow(() -> verify(chain).doFilter(request, response));
  }

  @Test
  void skipsActuatorHealth() {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
    assertTrue(filter.shouldNotFilter(request));
  }
}
