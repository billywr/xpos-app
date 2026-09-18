import { storage } from "@/utils/storage";
import { generateUuid } from "@/utils/uuid";
import type { ApiError } from "@/types";

const REQUEST_ID_HEADER = "X-Request-Id";

let defaultApiBaseUrl = "http://localhost:9003";

export function setDefaultApiBaseUrl(url: string) {
  defaultApiBaseUrl = url.replace(/\/$/, "");
}

export async function getBaseUrl(): Promise<string> {
  const stored = await storage.getApiBaseUrl();
  if (stored) return stored.replace(/\/$/, "");
  return defaultApiBaseUrl;
}

export interface RequestConfig {
  token?: string | null;
  requestId?: string;
  body?: unknown;
}

export async function apiFetch<T>(
  path: string,
  options: RequestConfig & Omit<RequestInit, "body"> = {}
): Promise<T> {
  const { token, requestId = generateUuid(), body, ...init } = options;
  const baseUrl = await getBaseUrl();
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
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const error: ApiError = {
      timestamp: new Date().toISOString(),
      status: 0,
      error: "NETWORK_ERROR",
      code: "NETWORK_ERROR",
      message:
        err instanceof Error
          ? err.message
          : "Cannot reach backend. Check your network or server URL.",
      path,
      requestId,
    };
    throw { status: 0, data: error };
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
    throw { status: res.status, data: apiError };
  }

  return data as T;
}
