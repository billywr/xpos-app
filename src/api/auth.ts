import { storage } from "@/utils/storage";

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

export function parseJwtSub(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json);
    return payload.sub ?? payload.preferred_username ?? null;
  } catch {
    return null;
  }
}

export async function loginKeycloak(params: {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  username: string;
  password: string;
}): Promise<{
  token: string;
  refreshToken: string | null;
  username: string;
}> {
  const url = `${params.keycloakUrl.replace(/\/$/, "")}/realms/${params.realm}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: params.clientId,
    username: params.username,
    password: params.password,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? "Login failed");
  }

  const token = data.access_token;
  const refreshToken = data.refresh_token ?? null;
  const sub = parseJwtSub(token);

  await storage.setAuthToken(token);
  if (refreshToken) {
    await storage.setRefreshToken(refreshToken);
  }

  return {
    token,
    refreshToken,
    username: sub ?? params.username,
  };
}

export async function refreshKeycloakToken(params: {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  refreshToken: string;
}): Promise<string> {
  const url = `${params.keycloakUrl.replace(/\/$/, "")}/realms/${params.realm}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    refresh_token: params.refreshToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Token refresh failed");
  }

  const token = data.access_token;
  await storage.setAuthToken(token);
  if (data.refresh_token) {
    await storage.setRefreshToken(data.refresh_token);
  }
  return token;
}
