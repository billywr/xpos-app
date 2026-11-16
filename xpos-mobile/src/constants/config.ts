/**
 * XPOS Mobile App Server & Keycloak IAM Configuration Defaults.
 */

export const DEFAULT_CONFIG = {
  /** Production backend Spring Boot API server URL */
  API_BASE_URL: "https://62.169.22.51:9005",

  /** Production Keycloak IAM server URL (KC_HOSTNAME: https://62.169.22.51:8443) */
  KEYCLOAK_URL: "https://62.169.22.51:8443",

  /** Default Keycloak realm */
  KEYCLOAK_REALM: "xpos",

  /** Default public client ID configured in Keycloak */
  KEYCLOAK_CLIENT_ID: "xpos-client-api",
} as const;

export const LOCALHOST_CONFIG = {
  /** Localhost backend API URL (matches local web app & Spring Boot server on port 9003) */
  API_BASE_URL: "http://localhost:9003",
  /** Localhost Keycloak IAM server URL */
  KEYCLOAK_URL: "http://localhost:8088",
  /** Localhost Keycloak realm */
  KEYCLOAK_REALM: "xpos",
  /** Default public client ID */
  KEYCLOAK_CLIENT_ID: "xpos-client-api",
} as const;
