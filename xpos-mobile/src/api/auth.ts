import { Platform } from "react-native";
import { storage } from "@/utils/storage";

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

function decodeBase64(input: string): string {
  const atobFn = typeof atob === "function" ? atob : (globalThis as unknown as { atob?: (s: string) => string }).atob;
  if (typeof atobFn === "function") {
    return atobFn(input);
  }
  return "";
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeBase64(base64);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

export function parseJwtUsername(token: string): string | null {
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  const username =
    (payload.preferred_username as string) ??
    (payload.name as string) ??
    (payload.given_name as string) ??
    null;
  if (username && !isUuid(username)) {
    return username;
  }
  return null;
}

export function parseJwtSub(token: string): string | null {
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  return (payload.sub as string) ?? (payload.preferred_username as string) ?? null;
}

export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() / 1000 >= payload.exp - bufferSeconds;
}

function resolveKeycloakTokenUrl(keycloakUrl: string, realm: string): string {
  const isWeb = Platform.OS === "web" && typeof window !== "undefined";
  // On Web, remote prod server (62.169.22.51) rejects cross-origin browser requests with CORS error.
  // Metro has a local reverse proxy on window.location.origin (/keycloak) that strips origin and forwards.
  if (isWeb && keycloakUrl.includes("62.169.22.51") && Boolean(window.location?.origin)) {
    return `${window.location.origin}/keycloak/realms/${realm}/protocol/openid-connect/token`;
  }
  return `${keycloakUrl.replace(/\/$/, "")}/realms/${realm}/protocol/openid-connect/token`;
}

export async function loginKeycloak(params: {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  username: string;
  password: string;
  timeoutMs?: number;
}): Promise<{
  token: string;
  refreshToken: string | null;
  username: string;
}> {
  const tokenUrl = resolveKeycloakTokenUrl(params.keycloakUrl, params.realm);

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: params.clientId,
    username: params.username,
    password: params.password,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? 15000);

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    if (isTimeout) {
      throw new Error(`Keycloak login timed out (${params.keycloakUrl}). Check server.`);
    }
    throw new Error(`Cannot reach Keycloak at ${params.keycloakUrl}. Check the URL or your connection.`);
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? `Login failed (${res.status})`);
  }

  const token = data.access_token;
  if (!token) {
    throw new Error("No access_token returned by Keycloak");
  }
  const refreshToken = data.refresh_token ?? null;
  const jwtUser = parseJwtUsername(token);
  const finalUsername =
    (jwtUser && !isUuid(jwtUser) ? jwtUser : null) ??
    (!isUuid(params.username) ? params.username : null) ??
    "Operator";

  await storage.setAuthToken(token);
  await storage.setUsername(finalUsername);
  if (refreshToken) {
    await storage.setRefreshToken(refreshToken);
  }

  return {
    token,
    refreshToken,
    username: finalUsername,
  };
}

export async function refreshKeycloakToken(params: {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  refreshToken: string;
  timeoutMs?: number;
}): Promise<string> {
  const tokenUrl = resolveKeycloakTokenUrl(params.keycloakUrl, params.realm);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    refresh_token: params.refreshToken,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? 15000);

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    throw new Error("Keycloak token refresh network failure");
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error("Token refresh failed");
  }

  const token = data.access_token;
  if (!token) {
    throw new Error("No access_token returned during refresh");
  }

  await storage.setAuthToken(token);
  const refreshedUser = parseJwtUsername(token);
  if (refreshedUser && !isUuid(refreshedUser)) {
    await storage.setUsername(refreshedUser);
  }
  if (data.refresh_token) {
    await storage.setRefreshToken(data.refresh_token);
  }
  return token;
}
