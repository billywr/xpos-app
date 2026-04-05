import { getSubFromToken } from "@/utils/jwt";
import { getEnv } from "@/utils/env";

const TOKEN_PATH = "/protocol/openid-connect/token";

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

export interface LoginParams {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  username: string;
  password: string;
}

/**
 * Login via Keycloak password grant. POST x-www-form-urlencoded to
 * {keycloakUrl}/realms/{realm}/protocol/openid-connect/token.
 * No client_secret (public/frontend client).
 * In dev we use the Vite proxy (/keycloak -> Keycloak). In production we use
 * same-origin /keycloak proxy when VITE_USE_KEYCLOAK_PROXY is set, to avoid CORS.
 */
export async function loginWithPassword(params: LoginParams): Promise<{
  token: string;
  iamUserId: string;
  expiresAt: number | null;
}> {
  const useProxy =
    (typeof window !== "undefined" && window.location?.origin
      ? String(getEnv("VITE_USE_KEYCLOAK_PROXY") ?? "").toLowerCase() === "true"
      : false);
  const baseUrl =
    typeof import.meta.env.DEV !== "undefined" && import.meta.env.DEV
      ? typeof window !== "undefined"
        ? `${window.location.origin}/keycloak`
        : ""
      : useProxy && typeof window !== "undefined"
        ? `${window.location.origin}/keycloak`
        : params.keycloakUrl.replace(/\/$/, "");
  const url = `${baseUrl}/realms/${params.realm}${TOKEN_PATH}`;
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
    const message =
      data.error_description ?? data.error ?? res.statusText ?? "Login failed";
    throw new Error(message);
  }

  const token = (data as KeycloakTokenResponse).access_token;
  if (!token) throw new Error("No access_token in response");

  const iamUserId = getSubFromToken(token);
  if (!iamUserId) throw new Error("Could not read user id from token");

  const expiresIn = (data as KeycloakTokenResponse).expires_in;
  const expiresAt =
    typeof expiresIn === "number"
      ? Date.now() + expiresIn * 1000
      : null;

  return { token, iamUserId, expiresAt };
}
