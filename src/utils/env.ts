declare global {
  interface Window {
    __env?: Partial<Record<string, string>>;
  }
}

/**
 * Static map of VITE_* env vars using dot-notation access so Vite can
 * replace each value at build time.  Dynamic bracket access like
 * `import.meta.env[key]` is NOT replaced in production builds — it
 * silently returns `undefined`.  This map is the build-time fallback
 * when `window.__env` (Docker runtime override) is absent.
 */
const BUILD_ENV: Record<string, string | undefined> = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_KEYCLOAK_URL: import.meta.env.VITE_KEYCLOAK_URL,
  VITE_KEYCLOAK_REALM: import.meta.env.VITE_KEYCLOAK_REALM,
  VITE_KEYCLOAK_CLIENT_ID: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  VITE_USE_KEYCLOAK_PROXY: import.meta.env.VITE_USE_KEYCLOAK_PROXY,
  VITE_IDLE_LOGOUT_MINUTES: import.meta.env.VITE_IDLE_LOGOUT_MINUTES,
  VITE_ROLE_ADMIN: import.meta.env.VITE_ROLE_ADMIN,
  VITE_ROLE_OPERATOR: import.meta.env.VITE_ROLE_OPERATOR,
};

export const DEFAULT_PROD_CONFIG = {
  API_BASE_URL: "https://62.169.22.51:9005",
  KEYCLOAK_URL: "https://62.169.22.51:8443",
  KEYCLOAK_REALM: "xpos",
  KEYCLOAK_CLIENT_ID: "xpos-client-api",
} as const;

export const DEFAULT_DEV_CONFIG = {
  API_BASE_URL: "http://localhost:9003",
  KEYCLOAK_URL: "http://localhost:8088",
  KEYCLOAK_REALM: "xpos",
  KEYCLOAK_CLIENT_ID: "xpos-client-api",
} as const;

const STORAGE_ENV_KEYS: Record<string, string> = {
  VITE_API_BASE_URL: "xpos:api_base_url",
  VITE_KEYCLOAK_URL: "xpos:keycloak_url",
  VITE_KEYCLOAK_REALM: "xpos:keycloak_realm",
  VITE_KEYCLOAK_CLIENT_ID: "xpos:keycloak_client_id",
};

/**
 * Read a VITE_* environment variable.
 * Priority:
 * 1. User runtime localStorage override (allows seamless environment switching)
 * 2. window.__env (Docker runtime override)
 * 3. BUILD_ENV (Vite build-time constant)
 */
export function getEnv(key: string): string | undefined {
  if (typeof window !== "undefined") {
    const storageKey = STORAGE_ENV_KEYS[key];
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null && stored !== "") {
        return stored;
      }
    }
  }
  const runtime = window.__env?.[key];
  return runtime !== undefined && runtime !== ""
    ? runtime
    : BUILD_ENV[key];
}

export interface ActiveServerConfig {
  apiBaseUrl: string;
  keycloakUrl: string;
  realm: string;
  clientId: string;
}

export function getActiveServerConfig(): ActiveServerConfig {
  return {
    apiBaseUrl: getEnv("VITE_API_BASE_URL") ?? DEFAULT_DEV_CONFIG.API_BASE_URL,
    keycloakUrl: getEnv("VITE_KEYCLOAK_URL") ?? DEFAULT_DEV_CONFIG.KEYCLOAK_URL,
    realm: getEnv("VITE_KEYCLOAK_REALM") ?? DEFAULT_DEV_CONFIG.KEYCLOAK_REALM,
    clientId: getEnv("VITE_KEYCLOAK_CLIENT_ID") ?? DEFAULT_DEV_CONFIG.KEYCLOAK_CLIENT_ID,
  };
}

export function setActiveServerConfig(config: ActiveServerConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("xpos:api_base_url", config.apiBaseUrl.trim());
  localStorage.setItem("xpos:keycloak_url", config.keycloakUrl.trim());
  localStorage.setItem("xpos:keycloak_realm", config.realm.trim());
  localStorage.setItem("xpos:keycloak_client_id", config.clientId.trim());
}

export function resetServerConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("xpos:api_base_url");
  localStorage.removeItem("xpos:keycloak_url");
  localStorage.removeItem("xpos:keycloak_realm");
  localStorage.removeItem("xpos:keycloak_client_id");
}
