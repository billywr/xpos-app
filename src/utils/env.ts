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

/**
 * Read a VITE_* environment variable.
 *
 * In production (Docker) the value comes from `window.__env`, which is
 * written by docker-entrypoint.sh before nginx starts. This lets any
 * VITE_* var be overridden at container start time without rebuilding.
 *
 * In local dev `window.__env` is undefined so the call falls through to
 * the build-time value from `.env`.
 */
export function getEnv(key: string): string | undefined {
  const runtime = window.__env?.[key];
  return runtime !== undefined && runtime !== ""
    ? runtime
    : BUILD_ENV[key];
}
