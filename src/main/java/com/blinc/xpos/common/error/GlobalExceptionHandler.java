package com.blinc.xpos.common.error;

import com.blinc.xpos.common.web.filter.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
  private static final int MAX_PUBLIC_MESSAGE_LEN = 500;

  private final Clock clock;
  private final DatabaseErrorTranslator databaseErrorTranslator;

  public GlobalExceptionHandler(Clock clock) {
    this.clock = Objects.requireNonNull(clock, "clock");
    this.databaseErrorTranslator = new DatabaseErrorTranslator(new ConstraintMessageCatalog());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> handleValidation(
      MethodArgumentNotValidException ex, HttpServletRequest request) {
    return build(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "One or more fields are invalid.",
        request,
        fieldErrors(ex.getBindingResult().getFieldErrors()));
  }

  @ExceptionHandler(BindException.class)
  public ResponseEntity<ApiError> handleBind(BindException ex, HttpServletRequest request) {
    return build(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "One or more fields are invalid.",
        request,
        fieldErrors(ex.getBindingResult().getFieldErrors()));
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiError> handleConstraintViolation(
      ConstraintViolationException ex, HttpServletRequest request) {
    List<ApiErrorDetail> details = new ArrayList<>();
    ex.getConstraintViolations()
        .forEach(
            v -> details.add(new ApiErrorDetail(v.getPropertyPath().toString(), v.getMessage())));
    return build(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "One or more fields are invalid.",
        request,
        details);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiError> handleNotReadable(
      HttpMessageNotReadableException ex, HttpServletRequest request) {
    String message = "Request body is not valid JSON.";
    Throwable cause = mostSpecificCause(ex);
    if (cause != null && cause.getMessage() != null && !cause.getMessage().isBlank()) {
      message = "Request body is not readable: " + safeMessage(cause.getMessage());
    }
    return build(HttpStatus.BAD_REQUEST, "MALFORMED_JSON", message, request, List.of());
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ApiError> handleMissingParameter(
      MissingServletRequestParameterException ex, HttpServletRequest request) {
    String message = "Missing required query parameter: " + ex.getParameterName() + ".";
    List<ApiErrorDetail> details = List.of(new ApiErrorDetail(ex.getParameterName(), message));
    return build(HttpStatus.BAD_REQUEST, "MISSING_PARAMETER", message, request, details);
  }

  @ExceptionHandler(MissingRequestHeaderException.class)
  public ResponseEntity<ApiError> handleMissingHeader(
      MissingRequestHeaderException ex, HttpServletRequest request) {
    String message = "Missing required header: " + ex.getHeaderName() + ".";
    List<ApiErrorDetail> details = List.of(new ApiErrorDetail(ex.getHeaderName(), message));
    return build(HttpStatus.BAD_REQUEST, "MISSING_HEADER", message, request, details);
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ApiError> handleTypeMismatch(
      MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
    String requiredType =
        ex.getRequiredType() == null ? "unknown" : ex.getRequiredType().getSimpleName();
    String message =
        "Invalid value for '" + ex.getName() + "'. Expected type: " + requiredType + ".";
    List<ApiErrorDetail> details = List.of(new ApiErrorDetail(ex.getName(), message));
    return build(HttpStatus.BAD_REQUEST, "TYPE_MISMATCH", message, request, details);
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ApiError> handleMethodNotSupported(
      HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
    String message = "HTTP method '" + ex.getMethod() + "' is not supported for this endpoint.";
    String supported =
        ex.getSupportedMethods() == null ? "" : String.join(", ", ex.getSupportedMethods());
    List<ApiErrorDetail> details =
        supported.isBlank()
            ? List.of()
            : List.of(new ApiErrorDetail("supportedMethods", supported));
    return build(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", message, request, details);
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ApiError> handleMediaTypeNotSupported(
      HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
    String message = "Content-Type '" + ex.getContentType() + "' is not supported.";
    List<ApiErrorDetail> details =
        List.of(new ApiErrorDetail("supported", String.valueOf(ex.getSupportedMediaTypes())));
    return build(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", message, request, details);
  }

  @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
  public ResponseEntity<ApiError> handleMediaTypeNotAcceptable(
      HttpMediaTypeNotAcceptableException ex, HttpServletRequest request) {
    String message = "Requested response media type is not acceptable.";
    List<ApiErrorDetail> details =
        List.of(new ApiErrorDetail("supported", String.valueOf(ex.getSupportedMediaTypes())));
    return build(HttpStatus.NOT_ACCEPTABLE, "NOT_ACCEPTABLE", message, request, details);
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ApiError> handleAccessDenied(
      AccessDeniedException ex, HttpServletRequest request) {
    return build(
        HttpStatus.FORBIDDEN,
        "FORBIDDEN",
        "You do not have permission to perform this action.",
        request,
        List.of());
  }

  @ExceptionHandler({InvalidBearerTokenException.class, OAuth2AuthenticationException.class})
  public ResponseEntity<ApiError> handleOAuth(HttpServletRequest request) {
    return build(
        HttpStatus.UNAUTHORIZED,
        "UNAUTHORIZED",
        "Missing or invalid access token.",
        request,
        List.of());
  }

  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<ApiError> handleAuthentication(
      AuthenticationException ex, HttpServletRequest request) {
    String message = "Missing or invalid access token.";
    if (ex instanceof BadCredentialsException) {
      message = "Invalid username or password.";
    }
    return build(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message, request, List.of());
  }

  @ExceptionHandler(SecurityException.class)
  public ResponseEntity<ApiError> handleSecurity(SecurityException ex, HttpServletRequest request) {
    String message = ex.getMessage() == null ? "Unauthorized." : safeMessage(ex.getMessage());
    return build(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message, request, List.of());
  }

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ApiError> handleApi(ApiException ex, HttpServletRequest request) {
    return build(ex.getStatus(), ex.getCode(), safeMessage(ex.getMessage()), request, List.of());
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiError> handleResponseStatus(
      ResponseStatusException ex, HttpServletRequest request) {
    String message =
        ex.getReason() == null ? ex.getStatusCode().toString() : safeMessage(ex.getReason());
    HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
    return build(status, "HTTP_" + status.value(), message, request, List.of());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ApiError> handleIllegalArgument(
      IllegalArgumentException ex, HttpServletRequest request) {
    String message = ex.getMessage() == null ? "Invalid request." : safeMessage(ex.getMessage());
    return build(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", message, request, List.of());
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ApiError> handleDataIntegrity(
      DataIntegrityViolationException ex, HttpServletRequest request) {
    DatabaseErrorTranslation t = this.databaseErrorTranslator.translate(ex);
    return build(t.status(), t.code(), t.message(), request, t.details());
  }

  @ExceptionHandler(OptimisticLockingFailureException.class)
  public ResponseEntity<ApiError> handleOptimisticLock(
      OptimisticLockingFailureException ex, HttpServletRequest request) {
    String message = "This record was updated by another user. Refresh and try again.";
    return build(HttpStatus.CONFLICT, "CONCURRENT_UPDATE", message, request, List.of());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> handleGeneric(Exception ex, HttpServletRequest request) {
    String requestId = (String) request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
    log.error("Unhandled error. requestId={} path={}", requestId, request.getRequestURI(), ex);
    String message =
        "Unexpected server error while processing the request. Provide requestId to support.";
    return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", message, request, List.of());
  }

  private ResponseEntity<ApiError> build(
      HttpStatus status,
      String code,
      String message,
      HttpServletRequest request,
      List<ApiErrorDetail> details) {
    String requestId = (String) request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
    ApiError body =
        new ApiError(
            Instant.now(this.clock),
            status.value(),
            status.getReasonPhrase(),
            code,
            message,
            request.getRequestURI(),
            requestId,
            details);
    return ResponseEntity.status(status).body(body);
  }

  private static List<ApiErrorDetail> fieldErrors(List<FieldError> errors) {
    List<ApiErrorDetail> details = new ArrayList<>();
    for (FieldError fe : errors) {
      String msg = fe.getDefaultMessage();
      if (msg == null || msg.isBlank()) {
        msg = "Invalid value.";
      }
      details.add(new ApiErrorDetail(fe.getField(), msg));
    }
    return details;
  }

  private static Throwable mostSpecificCause(Throwable ex) {
    Throwable cur = ex;
    Throwable next = ex;
    while (next != null) {
      cur = next;
      next = next.getCause();
    }
    if (cur == ex) {
      return ex.getCause();
    }
    return cur;
  }

  private static String safeMessage(String message) {
    String trimmed = message.trim();
    if (trimmed.length() <= MAX_PUBLIC_MESSAGE_LEN) {
      return trimmed;
    }
    return trimmed.substring(0, MAX_PUBLIC_MESSAGE_LEN);
  }
}
