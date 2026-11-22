package com.blinc.xpos.common.web.filter;

import com.blinc.xpos.common.constants.HeaderNames;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

/**
 * Access logging filter that logs HTTP request and response interactions formatted as structured,
 * pretty-printed JSON containing top-level REQUEST and RESPONSE keys:
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
  private static final int MAX_BODY_BYTES = 32768;
  private static final int MAX_ARRAY_ELEMENTS = 3;
  private static final int MAX_STRING_LENGTH = 200;
  private static final int MAX_TEXT_LENGTH = 500;
  private static final Pattern UUID_OR_HASH_PATTERN =
      Pattern.compile(
          "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:\\.[a-zA-Z0-9]+)?$");
  private static final Set<String> IGNORED_PATH_PREFIXES =
      Set.of("api", "v1", "admin", "operator", "integrations");
  private static final Set<String> SENSITIVE_HEADERS =
      Set.of("authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key");
  private static final Set<String> SENSITIVE_JSON_FIELDS =
      Set.of("password", "secret", "clientsecret", "pin", "token", "accesstoken", "refreshtoken");

  private final ObjectMapper objectMapper;

  public ApiAccessLoggingFilter() {
    this(new ObjectMapper());
  }

  public ApiAccessLoggingFilter(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
  }

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

    boolean isMultipart =
        request.getContentType() != null
            && request.getContentType().toLowerCase().startsWith("multipart/");

    HttpServletRequest requestToUse =
        isMultipart ? request : new ContentCachingRequestWrapper(request, MAX_BODY_BYTES);
    ContentCachingResponseWrapper responseToUse = new ContentCachingResponseWrapper(response);

    try {
      filterChain.doFilter(requestToUse, responseToUse);
    } finally {
      long duration = System.currentTimeMillis() - startTime;
      try {
        logAccess(requestToUse, responseToUse, duration);
      } catch (Exception ex) {
        log.error("Failed to log access", ex);
      } finally {
        responseToUse.copyBodyToResponse();
      }
    }
  }

  private void logAccess(
      HttpServletRequest request, ContentCachingResponseWrapper response, long duration) {
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
      requestId = request.getHeader(HeaderNames.REQUEST_ID);
    }
    if (requestId == null || requestId.isBlank()) {
      requestId = "-";
    }

    String resource = extractResource(uri);
    String reqKey = "REQUEST-" + resource;
    String resKey = "RESPONSE-" + resource;

    Map<String, Object> reqMap = new LinkedHashMap<>();
    reqMap.put("resource", resource);
    reqMap.put("requestId", requestId);
    reqMap.put("method", method);
    reqMap.put("path", path);
    reqMap.put("clientIp", extractClientIp(request));

    Map<String, String> reqHeaders = extractRequestHeaders(request);
    if (!reqHeaders.isEmpty()) {
      reqMap.put("headers", reqHeaders);
    }

    Object reqBody = extractRequestBody(request);
    if (reqBody != null) {
      reqMap.put("body", reqBody);
    }

    Map<String, Object> resMap = new LinkedHashMap<>();
    resMap.put("status", status);
    resMap.put("durationMs", duration);

    Map<String, String> resHeaders = extractResponseHeaders(response);
    if (!resHeaders.isEmpty()) {
      resMap.put("headers", resHeaders);
    }

    Object resBody = extractResponseBody(response);
    if (resBody != null) {
      resMap.put("body", resBody);
    }

    Map<String, Object> logPayload = new LinkedHashMap<>();
    logPayload.put(reqKey, reqMap);
    logPayload.put(resKey, resMap);

    String jsonString;
    try {
      jsonString = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(logPayload);
    } catch (JsonProcessingException e) {
      jsonString = logPayload.toString();
    }

    String header = "[" + resource + "] [HTTP " + method + " " + status + "] (" + duration + "ms)";
    if (status >= 500) {
      log.error("{}\n{}", header, jsonString);
    } else if (status >= 400) {
      log.warn("{}\n{}", header, jsonString);
    } else {
      log.info("{}\n{}", header, jsonString);
    }
  }

  static String extractResource(String uri) {
    if (uri == null || uri.isBlank() || uri.equals("/")) {
      return "root";
    }
    String cleanUri = uri.split("\\?")[0];
    String[] parts = cleanUri.split("/");
    List<String> meaningful = new ArrayList<>();
    for (String part : parts) {
      if (part == null || part.isBlank()) {
        continue;
      }
      if (IGNORED_PATH_PREFIXES.contains(part.toLowerCase())) {
        continue;
      }
      if (UUID_OR_HASH_PATTERN.matcher(part).matches()) {
        continue;
      }
      meaningful.add(part.toLowerCase());
    }

    if (meaningful.isEmpty()) {
      return "api";
    }

    if (meaningful.size() > 1
        && (meaningful.get(0).equals("orgs") || meaningful.get(0).equals("branches"))) {
      meaningful.remove(0);
    }
    if (meaningful.size() > 1 && meaningful.get(0).equals("branches")) {
      meaningful.remove(0);
    }

    return String.join("-", meaningful);
  }

  private String extractClientIp(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isBlank()) {
      return xForwardedFor.split(",")[0].trim();
    }
    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isBlank()) {
      return xRealIp.trim();
    }
    return request.getRemoteAddr();
  }

  private Map<String, String> extractRequestHeaders(HttpServletRequest request) {
    Map<String, String> headers = new LinkedHashMap<>();
    Enumeration<String> headerNames = request.getHeaderNames();
    if (headerNames != null) {
      while (headerNames.hasMoreElements()) {
        String name = headerNames.nextElement();
        if (name == null) {
          continue;
        }
        String lower = name.toLowerCase();
        if (SENSITIVE_HEADERS.contains(lower)) {
          headers.put(name, lower.equals("authorization") ? "Bearer ***" : "***");
        } else {
          headers.put(name, request.getHeader(name));
        }
      }
    }
    return headers;
  }

  private Map<String, String> extractResponseHeaders(HttpServletResponse response) {
    Map<String, String> headers = new LinkedHashMap<>();
    for (String name : response.getHeaderNames()) {
      if (name == null) {
        continue;
      }
      String lower = name.toLowerCase();
      if (SENSITIVE_HEADERS.contains(lower)) {
        headers.put(name, "***");
      } else {
        headers.put(name, response.getHeader(name));
      }
    }
    return headers;
  }

  private Object extractRequestBody(HttpServletRequest request) {
    if (request instanceof ContentCachingRequestWrapper wrapper) {
      byte[] buf = wrapper.getContentAsByteArray();
      if (buf.length > 0) {
        if (buf.length > MAX_BODY_BYTES) {
          return "[payload too large: " + buf.length + " bytes]";
        }
        String content = new String(buf, StandardCharsets.UTF_8).trim();
        if (content.isEmpty()) {
          return null;
        }
        try {
          JsonNode node = objectMapper.readTree(content);
          sanitizeAndTrimJson(node);
          return node;
        } catch (Exception e) {
          if (content.length() > MAX_TEXT_LENGTH) {
            return content.substring(0, MAX_TEXT_LENGTH)
                + "... [trimmed, total: "
                + content.length()
                + " chars]";
          }
          return content;
        }
      }
    }
    return null;
  }

  private Object extractResponseBody(ContentCachingResponseWrapper wrapper) {
    byte[] buf = wrapper.getContentAsByteArray();
    if (buf.length > 0) {
      if (buf.length > MAX_BODY_BYTES) {
        return "[payload too large: " + buf.length + " bytes]";
      }
      String contentType = wrapper.getContentType();
      if (contentType != null
          && (contentType.startsWith("image/")
              || contentType.startsWith("application/octet-stream"))) {
        return "[binary content: " + contentType + ", size: " + buf.length + " bytes]";
      }
      String content = new String(buf, StandardCharsets.UTF_8).trim();
      if (content.isEmpty()) {
        return null;
      }
      try {
        JsonNode node = objectMapper.readTree(content);
        sanitizeAndTrimJson(node);
        return node;
      } catch (Exception e) {
        if (content.length() > MAX_TEXT_LENGTH) {
          return content.substring(0, MAX_TEXT_LENGTH)
              + "... [trimmed, total: "
              + content.length()
              + " chars]";
        }
        return content;
      }
    }
    return null;
  }

  private void sanitizeAndTrimJson(JsonNode node) {
    if (node == null) {
      return;
    }
    if (node.isObject()) {
      ObjectNode obj = (ObjectNode) node;
      List<String> fieldNames = new ArrayList<>();
      obj.fieldNames().forEachRemaining(fieldNames::add);
      for (String name : fieldNames) {
        String lower = name.toLowerCase();
        if (SENSITIVE_JSON_FIELDS.contains(lower)) {
          obj.put(name, "***");
        } else {
          JsonNode child = obj.get(name);
          if (child != null && child.isTextual()) {
            String text = child.asText();
            if (text.length() > MAX_STRING_LENGTH) {
              obj.put(
                  name,
                  text.substring(0, MAX_STRING_LENGTH)
                      + "... [trimmed, total: "
                      + text.length()
                      + " chars]");
            }
          } else {
            sanitizeAndTrimJson(child);
          }
        }
      }
    } else if (node.isArray()) {
      ArrayNode arr = (ArrayNode) node;
      int originalSize = arr.size();
      if (originalSize > MAX_ARRAY_ELEMENTS) {
        while (arr.size() > MAX_ARRAY_ELEMENTS) {
          arr.remove(arr.size() - 1);
        }
        int trimmedCount = originalSize - MAX_ARRAY_ELEMENTS;
        arr.add(
            "... [trimmed: "
                + trimmedCount
                + (trimmedCount == 1 ? " more item, total: " : " more items, total: ")
                + originalSize
                + "]");
      }
      for (JsonNode item : arr) {
        sanitizeAndTrimJson(item);
      }
    }
  }
}
