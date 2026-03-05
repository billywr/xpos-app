#!/usr/bin/env bash
# XPOS deployment script - runs frontend and backend with Docker
# Requires: Docker and Docker Compose v2
# Usage: ./deploy.sh [up|down|status|health|logs]

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default env file
ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Warning: $ENV_FILE not found. Using defaults. Copy .env.example to .env and set image names."
fi

# Default ports (override via .env or export)
export XPOS_PORT="${XPOS_PORT:-9003}"
export XPOS_UI_PORT="${XPOS_UI_PORT:-80}"
export KEYCLOAK_PORT="${KEYCLOAK_PORT:-8080}"
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    if [[ "$line" =~ ^XPOS_PORT= ]]; then XPOS_PORT="${line#*=}"; fi
    if [[ "$line" =~ ^XPOS_UI_PORT= ]]; then XPOS_UI_PORT="${line#*=}"; fi
    if [[ "$line" =~ ^KEYCLOAK_PORT= ]]; then KEYCLOAK_PORT="${line#*=}"; fi
  done < "$ENV_FILE" 2>/dev/null || true
fi

COMPOSE_FILE="docker-compose.deploy.yml"

cmd_up() {
  echo "Starting XPOS stack..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
  echo ""
  echo "Waiting for services to be healthy (up to 90s)..."
  sleep 10
  local max=18
  local n=0
  while [[ $n -lt $max ]]; do
    if curl -sf "http://localhost:${XPOS_PORT}/actuator/health" >/dev/null 2>&1; then
      echo "Backend is up."
      break
    fi
    echo "  waiting for backend... ($((n*5))s)"
    sleep 5
    n=$((n+1))
  done
  if [[ $n -eq $max ]]; then
    echo "Backend did not become healthy in time. Check: docker compose -f $COMPOSE_FILE logs xpos"
    exit 1
  fi
  echo ""
  echo "XPOS is ready:"
  echo "  Frontend: http://localhost:${XPOS_UI_PORT}"
  echo "  Backend:  http://localhost:${XPOS_PORT}"
  echo "  Keycloak: http://localhost:${KEYCLOAK_PORT}"
}

cmd_down() {
  echo "Stopping XPOS stack..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
  echo "Stopped."
}

cmd_status() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
}

cmd_health() {
  echo "Backend health:"
  curl -sf "http://localhost:${XPOS_PORT}/actuator/health" 2>/dev/null | head -1 || echo "FAIL (is backend running?)"
  echo ""
  echo "Frontend health:"
  curl -sf "http://localhost:${XPOS_UI_PORT}/health" 2>/dev/null || echo "FAIL (is frontend running?)"
}

cmd_logs() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f "${@:-}"
}

case "${1:-up}" in
  up)    cmd_up ;;
  down)  cmd_down ;;
  status) cmd_status ;;
  health) cmd_health ;;
  logs)  shift; cmd_logs "$@" ;;
  *)
    echo "Usage: $0 {up|down|status|health|logs}"
    exit 1
    ;;
esac
