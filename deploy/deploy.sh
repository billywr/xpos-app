#!/usr/bin/env bash
# XPOS deployment script - runs frontend and backend with Docker
# Requires: Docker, Docker Compose v2, and external Postgres, Redis, Kafka, Keycloak
# Usage: ./deploy.sh [up|down|status|health|logs|check]
#
# Prerequisites (must already be running on host):
#   - PostgreSQL, Redis, Kafka, Keycloak
#   - Configure .env with connection details (see .env.example)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Copy .env.example to .env and configure."
  exit 1
fi

# Default ports (override via .env or export)
export XPOS_PORT="${XPOS_PORT:-9003}"
export XPOS_UI_PORT="${XPOS_UI_PORT:-9011}"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  if [[ "$line" =~ ^XPOS_PORT= ]]; then XPOS_PORT="${line#*=}"; fi
  if [[ "$line" =~ ^XPOS_UI_PORT= ]]; then XPOS_UI_PORT="${line#*=}"; fi
done < "$ENV_FILE" 2>/dev/null || true

COMPOSE_FILE="docker-compose.deploy.yml"

cmd_up() {
  echo "Starting XPOS stack (backend + frontend)..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
  echo ""
  echo "Waiting for backend to be healthy (up to 90s)..."
  sleep 5
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
    echo "Backend did not become healthy in time. Check: ./deploy.sh logs xpos"
    exit 1
  fi
  echo ""
  echo "XPOS is ready:"
  echo "  Frontend: http://localhost:${XPOS_UI_PORT}"
  echo "  Backend:  http://localhost:${XPOS_PORT}"
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

cmd_check() {
  echo "Verifying prerequisites (Postgres, Redis, Kafka, Keycloak reachable)..."
  local err=0
  # For host-side check: host.docker.internal => localhost (script runs on host)
  local pg_host="${POSTGRES_HOST:-host.docker.internal}"; [[ "$pg_host" == "host.docker.internal" ]] && pg_host="localhost"
  local pg_port="${POSTGRES_PORT:-5432}"
  local redis_host="${REDIS_HOST:-host.docker.internal}"; [[ "$redis_host" == "host.docker.internal" ]] && redis_host="localhost"
  local redis_port="${REDIS_PORT:-6379}"
  local kafka_servers="${KAFKA_BOOTSTRAP_SERVERS:-host.docker.internal:9092}"
  local kafka_host="${kafka_servers%%:*}"; [[ "$kafka_host" == "host.docker.internal" ]] && kafka_host="localhost"
  local kafka_port="${kafka_servers##*:}"; [[ "$kafka_port" == "$kafka_servers" ]] && kafka_port=9092
  local keycloak_host="${KEYCLOAK_HOST:-localhost}"
  local keycloak_port="${KEYCLOAK_PORT:-8080}"

  if command -v nc >/dev/null 2>&1; then
    (nc -z -w2 "$pg_host" "$pg_port" 2>/dev/null) && echo "  Postgres: OK ($pg_host:$pg_port)" || { echo "  Postgres: FAIL"; err=1; }
    (nc -z -w2 "$redis_host" "$redis_port" 2>/dev/null) && echo "  Redis: OK ($redis_host:$redis_port)" || { echo "  Redis: FAIL"; err=1; }
    (nc -z -w2 "$kafka_host" "$kafka_port" 2>/dev/null) && echo "  Kafka: OK ($kafka_host:$kafka_port)" || { echo "  Kafka: FAIL"; err=1; }
  else
    echo "  (install nc/netcat for connectivity checks)"
  fi
  if curl -sf --connect-timeout 3 "http://${keycloak_host}:${keycloak_port}/health/ready" >/dev/null 2>&1; then
    echo "  Keycloak: OK ($keycloak_host:$keycloak_port)"
  else
    echo "  Keycloak: FAIL or not reachable (port $keycloak_port)"
    err=1
  fi
  [[ $err -eq 0 ]] && echo "Prerequisites OK." || { echo "Fix failing services before deploy."; exit 1; }
}

# Load POSTGRES_HOST etc from .env for cmd_check (avoid source for special chars in passwords)
load_env_for_check() {
  [[ ! -f "$ENV_FILE" ]] && return
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    if [[ "$line" =~ ^POSTGRES_HOST= ]]; then POSTGRES_HOST="${line#*=}"; fi
    if [[ "$line" =~ ^POSTGRES_PORT= ]]; then POSTGRES_PORT="${line#*=}"; fi
    if [[ "$line" =~ ^REDIS_HOST= ]]; then REDIS_HOST="${line#*=}"; fi
    if [[ "$line" =~ ^REDIS_PORT= ]]; then REDIS_PORT="${line#*=}"; fi
    if [[ "$line" =~ ^KAFKA_BOOTSTRAP_SERVERS= ]]; then KAFKA_BOOTSTRAP_SERVERS="${line#*=}"; fi
    if [[ "$line" =~ ^KEYCLOAK_HOST= ]]; then KEYCLOAK_HOST="${line#*=}"; fi
    if [[ "$line" =~ ^KEYCLOAK_PORT= ]]; then KEYCLOAK_PORT="${line#*=}"; fi
  done < "$ENV_FILE" 2>/dev/null || true
}

case "${1:-up}" in
  up)    cmd_up ;;
  down)  cmd_down ;;
  status) cmd_status ;;
  health) cmd_health ;;
  check) load_env_for_check; cmd_check ;;
  logs)  shift; cmd_logs "$@" ;;
  *)
    echo "Usage: $0 {up|down|status|health|check|logs}"
    exit 1
    ;;
esac
