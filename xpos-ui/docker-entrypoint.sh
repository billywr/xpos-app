#!/bin/sh
set -e

# Configurable nginx web root — override with NGINX_HTML if your server uses a different path.
NGINX_HTML="${NGINX_HTML:-/etc/nginx/html}"

# Write runtime env vars into /env.js so the browser can read them.
# This allows VITE_* vars to be overridden at container start without rebuilding.
cat > "${NGINX_HTML}/env.js" <<EOF
window.__env = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_KEYCLOAK_URL: "${VITE_KEYCLOAK_URL:-}",
  VITE_KEYCLOAK_REALM: "${VITE_KEYCLOAK_REALM:-}",
  VITE_KEYCLOAK_CLIENT_ID: "${VITE_KEYCLOAK_CLIENT_ID:-}",
  VITE_USE_KEYCLOAK_PROXY: "${VITE_USE_KEYCLOAK_PROXY:-}",
  VITE_IDLE_LOGOUT_MINUTES: "${VITE_IDLE_LOGOUT_MINUTES:-}",
  VITE_ROLE_ADMIN: "${VITE_ROLE_ADMIN:-xpos-admin}",
  VITE_ROLE_OPERATOR: "${VITE_ROLE_OPERATOR:-xpos-operator}"
};
EOF

# Substitute KEYCLOAK_PROXY_PASS (default: host.docker.internal:8088) into nginx config
export KEYCLOAK_PROXY_PASS="${KEYCLOAK_PROXY_PASS:-host.docker.internal:8088}"
envsubst '${KEYCLOAK_PROXY_PASS}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
