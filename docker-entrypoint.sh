#!/bin/sh
set -e
# Substitute KEYCLOAK_PROXY_PASS (default: host.docker.internal:8088) into nginx config
export KEYCLOAK_PROXY_PASS="${KEYCLOAK_PROXY_PASS:-host.docker.internal:8088}"
envsubst '${KEYCLOAK_PROXY_PASS}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
