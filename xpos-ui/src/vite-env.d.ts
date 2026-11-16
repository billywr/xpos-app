/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_KEYCLOAK_URL: string;
  readonly VITE_KEYCLOAK_REALM: string;
  readonly VITE_KEYCLOAK_CLIENT_ID: string;
  readonly VITE_USE_KEYCLOAK_PROXY?: string;
  readonly VITE_APP_NAME?: string;
  /** Minutes until idle auto-logout (optional; default 5 if unset or invalid). */
  readonly VITE_IDLE_LOGOUT_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
