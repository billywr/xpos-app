import { Platform } from "react-native";
import { storage } from "@/utils/storage";
import { generateUuid } from "@/utils/uuid";
import { DEFAULT_CONFIG } from "@/constants/config";
import { refreshKeycloakToken } from "./auth";
import type { ApiError } from "@/types";
import { systemErrorLogger } from "@/services/systemErrorLogger";

const REQUEST_ID_HEADER = "X-Request-Id";
const DEFAULT_TIMEOUT_MS = 30000;

let defaultApiBaseUrl: string = DEFAULT_CONFIG.API_BASE_URL;

export function setDefaultApiBaseUrl(url: string) {
  defaultApiBaseUrl = url.replace(/\/$/, "");
}

export async function getBaseUrl(): Promise<string> {
  const stored = await storage.getApiBaseUrl();
  if (stored) return stored.replace(/\/$/, "");
  return defaultApiBaseUrl;
}

let on401: (() => void) | null = null;
let onTokenRefreshed: ((token: string) => void) | null = null;
let refreshPromise: Promise<string> | null = null;

export function set401Handler(handler: (() => void) | null): void {
  on401 = handler;
}

export function setTokenRefreshedHandler(handler: ((token: string) => void) | null): void {
  onTokenRefreshed = handler;
}

async function tryRefreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token available");

    const keycloakUrl = (await storage.getKeycloakUrl()) || DEFAULT_CONFIG.KEYCLOAK_URL;
    const realm = (await storage.getRealm()) || DEFAULT_CONFIG.KEYCLOAK_REALM;
    const clientId = (await storage.getClientId()) || DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID;

    const newToken = await refreshKeycloakToken({
      keycloakUrl,
      realm,
      clientId,
      refreshToken,
    });

    if (onTokenRefreshed) {
      onTokenRefreshed(newToken);
    }
    return newToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export interface RequestConfig {
  token?: string | null;
  requestId?: string;
  body?: unknown;
  timeoutMs?: number;
  _isRetry?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: RequestConfig & Omit<RequestInit, "body"> = {}
): Promise<T> {
  let { token, requestId = generateUuid(), body, timeoutMs = DEFAULT_TIMEOUT_MS, _isRetry, ...init } = options;
  if (!token) {
    token = await storage.getAuthToken();
  }
  const baseUrl = await getBaseUrl();
  const isWeb = Platform.OS === "web" && typeof window !== "undefined";
  // On Web, remote prod server (62.169.22.51) rejects cross-origin browser requests with 403.
  // Metro has a local reverse proxy on window.location.origin (/api/) that strips origin and forwards.
  const useWebProxy = isWeb && baseUrl.includes("62.169.22.51") && Boolean(window.location?.origin);
  const url = path.startsWith("http")
    ? path
    : useWebProxy
    ? `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
    : `${baseUrl}${path}`;

  const headers = new Headers(init.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined && body !== null) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response | null = null;
  let lastErr: unknown = null;

  try {
    const attempt = await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
    res = attempt;
  } catch (err) {
    lastErr = err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res) {
    const errStr = (lastErr instanceof Error ? lastErr.message : String(lastErr ?? "")).toLowerCase();
    const isTimeout =
      lastErr instanceof Error &&
      (lastErr.name === "AbortError" ||
        lastErr.name === "TimeoutError" ||
        errStr.includes("canceled") ||
        errStr.includes("cancelled") ||
        errStr.includes("aborted") ||
        errStr.includes("timeout"));
    const error: ApiError = {
      timestamp: new Date().toISOString(),
      status: 0,
      error: isTimeout ? "TIMEOUT_ERROR" : "NETWORK_ERROR",
      code: isTimeout ? "TIMEOUT_ERROR" : "NETWORK_ERROR",
      message: isTimeout
        ? "Request timed out. Please check your internet connection."
        : lastErr instanceof Error && !lastErr.message.includes("fetch failed")
        ? lastErr.message
        : "Cannot reach backend. Check your network or server URL.",
      path,
      requestId,
    };
    void systemErrorLogger.recordError({
      errorCode: error.code || "NETWORK_ERROR",
      message: error.message,
      status: 0,
      source: path,
      requestId,
      details: error,
    });
    throw { status: 0, data: error };
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      if (!options._isRetry) {
        try {
          const newToken = await tryRefreshToken();
          if (newToken) {
            return apiFetch<T>(path, {
              ...options,
              token: newToken,
              _isRetry: true,
            });
          }
        } catch {
          if (on401) {
            on401();
          }
        }
      } else if (on401) {
        on401();
      }
    }

    const apiError: ApiError = isJson
      ? data
      : {
          timestamp: new Date().toISOString(),
          status: res.status,
          error: res.statusText,
          code: "UNKNOWN",
          message: typeof data === "string" ? data : "Request failed",
          path,
          requestId: res.headers.get(REQUEST_ID_HEADER) ?? requestId,
        };
    console.warn(`[apiFetch] HTTP ${res.status} for ${path}:`, apiError);
    void systemErrorLogger.recordError({
      errorCode: apiError.code || `HTTP_${res.status}`,
      message: apiError.message || `Request failed with status ${res.status}`,
      status: res.status,
      source: path,
      requestId: res.headers.get(REQUEST_ID_HEADER) ?? requestId,
      details: apiError,
    });
    throw { status: res.status, data: apiError };
  }

  return data as T;
}

export interface DetailedApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  rawText: string;
  requestId: string;
}

export async function apiFetchDetailed<T = any>(
  path: string,
  options: RequestConfig & Omit<RequestInit, "body"> = {}
): Promise<DetailedApiResponse<T>> {
  let { token, requestId = generateUuid(), body, timeoutMs = DEFAULT_TIMEOUT_MS, _isRetry, ...init } = options;
  if (!token) {
    token = await storage.getAuthToken();
  }
  const baseUrl = await getBaseUrl();
  const isWeb = Platform.OS === "web" && typeof window !== "undefined";
  const useWebProxy = isWeb && baseUrl.includes("62.169.22.51") && Boolean(window.location?.origin);
  const url = path.startsWith("http")
    ? path
    : useWebProxy
    ? `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
    : `${baseUrl}${path}`;

  const headers = new Headers(init.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined && body !== null) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response | null = null;
  let lastErr: unknown = null;

  try {
    const attempt = await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
    res = attempt;
  } catch (err) {
    lastErr = err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res) {
    const errStr = (lastErr instanceof Error ? lastErr.message : String(lastErr ?? "")).toLowerCase();
    const isTimeout =
      lastErr instanceof Error &&
      (lastErr.name === "AbortError" ||
        lastErr.name === "TimeoutError" ||
        errStr.includes("canceled") ||
        errStr.includes("cancelled") ||
        errStr.includes("aborted") ||
        errStr.includes("timeout"));
    const error: ApiError = {
      timestamp: new Date().toISOString(),
      status: 0,
      error: isTimeout ? "TIMEOUT_ERROR" : "NETWORK_ERROR",
      code: isTimeout ? "TIMEOUT_ERROR" : "NETWORK_ERROR",
      message: isTimeout
        ? "Request timed out. Please check your internet connection."
        : lastErr instanceof Error && !lastErr.message.includes("fetch failed")
        ? lastErr.message
        : "Cannot reach backend. Check your network or server URL.",
      path,
      requestId,
    };
    void systemErrorLogger.recordError({
      errorCode: error.code || "NETWORK_ERROR",
      message: error.message,
      status: 0,
      source: path,
      requestId,
      details: error,
    });
    throw { status: 0, data: error, rawText: JSON.stringify(error), requestId };
  }

  if (res.status === 204) {
    return { status: 204, ok: true, data: undefined as T, rawText: "", requestId };
  }

  const rawText = await res.text();
  let data: any = rawText;
  try {
    data = JSON.parse(rawText);
  } catch {}

  if (!res.ok) {
    if (res.status === 401 && !options._isRetry) {
      try {
        const newToken = await tryRefreshToken();
        if (newToken) {
          return apiFetchDetailed<T>(path, {
            ...options,
            token: newToken,
            _isRetry: true,
          });
        }
      } catch {
        if (on401) on401();
      }
    } else if (res.status === 401 && on401) {
      on401();
    }

    const apiError: ApiError =
      typeof data === "object" && data !== null
        ? data
        : {
            timestamp: new Date().toISOString(),
            status: res.status,
            error: res.statusText,
            code: "UNKNOWN",
            message: rawText || "Request failed",
            path,
            requestId: res.headers.get(REQUEST_ID_HEADER) ?? requestId,
          };
    void systemErrorLogger.recordError({
      errorCode: apiError.code || `HTTP_${res.status}`,
      message: apiError.message || `Request failed with status ${res.status}`,
      status: res.status,
      source: path,
      requestId: res.headers.get(REQUEST_ID_HEADER) ?? requestId,
      details: apiError,
    });
    throw { status: res.status, data: apiError, rawText, requestId };
  }

  return {
    status: res.status,
    ok: true,
    data: data as T,
    rawText,
    requestId: res.headers.get(REQUEST_ID_HEADER) ?? requestId,
  };
}
