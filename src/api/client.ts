import type { ApiError } from "@/types/api";
import { generateUuid } from "@/utils/uuid";
import { getEnv } from "@/utils/env";

const REQUEST_ID_HEADER = "X-Request-Id";

let on401: (() => void) | null = null;

/**
 * Register a global handler for 401 Unauthorized. When the backend returns 401,
 * this is called before throwing so the app can clear auth and redirect to login.
 */
export function set401Handler(handler: (() => void) | null): void {
  on401 = handler;
}

export function getApiBaseUrl(): string {
  const base = getEnv("VITE_API_BASE_URL");
  if (!base) return "";
  return base.replace(/\/$/, "");
}

function getBaseUrl(): string {
  return getApiBaseUrl();
}

function getRequestId(): string {
  return generateUuid();
}

export interface RequestConfig {
  token?: string | null;
  requestId?: string;
  body?: unknown;
}

const NETWORK_ERROR_MESSAGE =
  "Cannot reach server. Check that the backend is running and VITE_API_BASE_URL is correct.";

/**
 * Central API client. Injects base URL, Authorization, Content-Type, X-Request-Id.
 * Parses non-2xx as ApiError and throws { status, data: ApiError }.
 * Network failures (e.g. "Failed to fetch") throw a synthetic ApiError with a user-friendly message.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestConfig & Omit<RequestInit, "body"> = {}
): Promise<T> {
  const { token, requestId = getRequestId(), body, ...init } = options;
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const headers = new Headers(init.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined && body !== null) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body:
        body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message === "Failed to fetch"
        ? NETWORK_ERROR_MESSAGE
        : err instanceof Error
          ? err.message
          : "Network error";
    const apiError: ApiError = {
      timestamp: new Date().toISOString(),
      status: 0,
      error: "NETWORK_ERROR",
      code: "NETWORK_ERROR",
      message,
      path,
      requestId,
    };
    throw { status: 0, data: apiError };
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
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
    if (res.status === 401 && on401) {
      on401();
    }
    throw { status: res.status, data: apiError };
  }

  return data as T;
}

export function buildPageQuery(params: { page?: number; size?: number; sort?: string }): string {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  if (params.sort) search.set("sort", params.sort);
  const q = search.toString();
  return q ? `?${q}` : "";
}
