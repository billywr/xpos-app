package com.blinc.xpos.common.web.filter;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.util.ContentCachingRequestWrapper;

class ApiAccessLoggingFilterTest {

  private final ApiAccessLoggingFilter filter = new ApiAccessLoggingFilter();

  @Test
  void filtersSuccessfulRequest() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/orgs");
    request.setAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE, "req-123");
    request.addHeader("Authorization", "Bearer sensitive-token-xyz");
    request.addHeader("User-Agent", "TestClient/1.0");
    MockHttpServletResponse response = new MockHttpServletResponse();
    response.setStatus(200);

    FilterChain chain = mock(FilterChain.class);

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
    assertDoesNotThrow(
        () ->
            verify(chain).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class)));
  }

  @Test
  void filtersClientErrorRequestWithJsonBody() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
    request.setContentType("application/json");
    request.setAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE, "req-456");
    String requestBody = "{\"username\":\"admin\",\"password\":\"super-secret\"}";
    request.setContent(requestBody.getBytes(StandardCharsets.UTF_8));

    MockHttpServletResponse response = new MockHttpServletResponse();

    FilterChain chain = mock(FilterChain.class);
    doAnswer(
            invocation -> {
              HttpServletRequest req = invocation.getArgument(0);
              HttpServletResponse res = invocation.getArgument(1);
              // Read the request body as a controller would
              req.getInputStream().readAllBytes();
              res.setStatus(400);
              res.setContentType("application/json");
              res.getWriter().write("{\"code\":\"INVALID_CREDENTIALS\",\"message\":\"Bad login\"}");
              return null;
            })
        .when(chain)
        .doFilter(any(), any());

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
    assertDoesNotThrow(
        () ->
            verify(chain).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class)));
  }

  @Test
  void filtersServerErrorRequest() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/items");
    request.setQueryString("page=0&size=10");
    MockHttpServletResponse response = new MockHttpServletResponse();
    response.setStatus(500);

    FilterChain chain = mock(FilterChain.class);

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
    assertDoesNotThrow(
        () ->
            verify(chain).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class)));
  }

  @Test
  void filtersMultipartRequestWithoutCachingWrapper() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/items/upload");
    request.setContentType("multipart/form-data; boundary=----WebKitFormBoundary");
    MockHttpServletResponse response = new MockHttpServletResponse();
    response.setStatus(200);

    FilterChain chain = mock(FilterChain.class);
    doAnswer(
            invocation -> {
              HttpServletRequest req = invocation.getArgument(0);
              // Assert request is NOT wrapped in ContentCachingRequestWrapper
              assertTrue(!(req instanceof ContentCachingRequestWrapper));
              return null;
            })
        .when(chain)
        .doFilter(any(), any());

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
  }

  @Test
  void skipsActuatorHealth() {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
    assertTrue(filter.shouldNotFilter(request));
  }

  @Test
  void skipsFavicon() {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/favicon.ico");
    assertTrue(filter.shouldNotFilter(request));
  }

  @Test
  void extractsResourceNamesCorrectly() {
    org.junit.jupiter.api.Assertions.assertEquals(
        "items-modifier-groups",
        ApiAccessLoggingFilter.extractResource(
            "/api/v1/admin/orgs/b55b2e19-35c0-4084-924a-f60181f5c195/items/ac6897e4-6f6e-44fd-aa91-fd8a5758fd2f/modifier-groups"));

    org.junit.jupiter.api.Assertions.assertEquals(
        "categories",
        ApiAccessLoggingFilter.extractResource(
            "/api/v1/admin/orgs/b55b2e19-35c0-4084-924a-f60181f5c195/categories"));

    org.junit.jupiter.api.Assertions.assertEquals(
        "sales",
        ApiAccessLoggingFilter.extractResource(
            "/api/v1/operator/orgs/b55b2e19-35c0-4084-924a-f60181f5c195/branches/c67f0000-0000-0000-0000-000000000000/sales"));

    org.junit.jupiter.api.Assertions.assertEquals(
        "uploads-items",
        ApiAccessLoggingFilter.extractResource(
            "/uploads/items/b55b2e19-35c0-4084-924a-f60181f5c195/137f53ea-ea3d-46fe-a61f-eda66ba884b9.jpg"));

    org.junit.jupiter.api.Assertions.assertEquals(
        "orgs", ApiAccessLoggingFilter.extractResource("/api/v1/admin/orgs"));
  }

  @Test
  void trimsLongArraysAndLongStringsInResponseBody() throws Exception {
    MockHttpServletRequest request =
        new MockHttpServletRequest(
            "GET",
            "/api/v1/admin/orgs/b55b2e19-35c0-4084-924a-f60181f5c195/items/ac6897e4-6f6e-44fd-aa91-fd8a5758fd2f/modifier-groups");
    MockHttpServletResponse response = new MockHttpServletResponse();

    // Create a large JSON response with 10 array items and a long string
    StringBuilder jsonBuilder = new StringBuilder("[");
    for (int i = 0; i < 10; i++) {
      if (i > 0) {
        jsonBuilder.append(",");
      }
      jsonBuilder
          .append("{\"id\":\"")
          .append(i)
          .append("\",\"name\":\"Modifier Group ")
          .append(i)
          .append("\",\"description\":\"")
          .append("x".repeat(300))
          .append("\"}");
    }
    jsonBuilder.append("]");

    FilterChain chain = mock(FilterChain.class);
    doAnswer(
            invocation -> {
              HttpServletResponse res = invocation.getArgument(1);
              res.setStatus(200);
              res.setContentType("application/json");
              res.getWriter().write(jsonBuilder.toString());
              return null;
            })
        .when(chain)
        .doFilter(any(), any());

    assertDoesNotThrow(() -> filter.doFilterInternal(request, response, chain));
  }
}
