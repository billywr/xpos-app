# XPOS Deployment Guide

This document describes how to deploy XPOS (frontend + backend) on any machine with Docker and Docker Compose. It assumes Docker images are already built and pushed to a registry (or available locally).

## Prerequisites

- **Docker** (25+ recommended)
- **Docker Compose** v2 (included with Docker)
- **curl** (for health checks)

Ports **9003**, **80**, **5433**, **6380**, **9093**, **8080** must be available on the host (or configure alternatives via `.env`).

## Quick Start

```bash
# 1. Clone and enter deploy directory
cd xpos/deploy

# 2. Create .env from example and set your image names
cp .env.example .env
# Edit .env: set XPOS_IMAGE and XPOS_UI_IMAGE to your pushed images

# 3. Deploy
./deploy.sh up
```

When the stack is ready, you will see:

```
XPOS is ready:
  Frontend: http://localhost:80
  Backend:  http://localhost:9003
  Keycloak: http://localhost:8080
```

## Deployment Artifacts

| File | Purpose |
|------|---------|
| `deploy/docker-compose.deploy.yml` | Compose stack (Postgres, Redis, Kafka, Keycloak, xpos, xpos-ui) |
| `deploy/.env.example` | Example configuration (copy to `.env`) |
| `deploy/deploy.sh` | Convenience script: up, down, status, health, logs |

## Configuration

### Required Environment Variables (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `XPOS_IMAGE` | Backend image (e.g. `ghcr.io/myorg/xpos:latest`) | `ghcr.io/your-org/xpos:latest` |
| `XPOS_UI_IMAGE` | Frontend image (e.g. `ghcr.io/myorg/xpos-ui:latest`) | `ghcr.io/your-org/xpos-ui:latest` |

### Optional (Ports & Credentials)

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PORT` | Host port for Postgres | 5433 |
| `REDIS_PORT` | Host port for Redis | 6380 |
| `KAFKA_PORT` | Host port for Kafka | 9093 |
| `KEYCLOAK_PORT` | Host port for Keycloak | 8080 |
| `XPOS_PORT` | Host port for backend | 9003 |
| `XPOS_UI_PORT` | Host port for frontend | 80 |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | DB credentials | postgres/postgres/xpos |
| `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_REALM` | Keycloak config | admin/admin/master |

### Frontend Build-Time Variables

The frontend image must be built with the correct URLs for your deployment:

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:9003 \
  --build-arg VITE_KEYCLOAK_URL=http://localhost:8080 \
  --build-arg VITE_KEYCLOAK_REALM=master \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=xpos-client-api \
  -t xpos-ui:latest .
```

Replace `localhost` with your actual host when deploying to a server.

## Deploy Script Commands

| Command | Description |
|---------|-------------|
| `./deploy.sh up` | Start stack, wait for backend health (~90s max) |
| `./deploy.sh down` | Stop and remove containers |
| `./deploy.sh status` | Show container status |
| `./deploy.sh health` | Curl backend `/actuator/health` and frontend `/health` |
| `./deploy.sh logs [service]` | Tail logs (optional: service name) |

## Manual Docker Compose

If you prefer not to use the script:

```bash
cd deploy
docker compose -f docker-compose.deploy.yml --env-file .env up -d
```

## Stack Architecture

```
                    ┌─────────────┐
                    │   xpos-ui  │  :80
                    │  (Nginx)   │
                    └──────┬─────┘
                           │
                    ┌──────▼─────┐
                    │   xpos    │  :9003
                    │ (Spring)  │
                    └──────┬─────┘
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
    │Postgres│      │   Redis   │     │   Kafka   │
    │ :5433  │      │   :6380   │     │   :9093   │
    └────────┘      └───────────┘     └───────────┘
                           │
                    ┌──────▼─────┐
                    │  Keycloak  │  :8080
                    └────────────┘
```

## Test Results

Deployment scripts were tested on **2026-03-05** with the following setup.

### Build Steps

1. **Backend image**
   ```bash
   cd xpos && docker build -t xpos:deploy-test .
   ```

2. **Frontend image**
   ```bash
   cd xpos-ui && docker build \
     --build-arg VITE_API_BASE_URL=http://localhost:9004 \
     --build-arg VITE_KEYCLOAK_URL=http://localhost:8080 \
     --build-arg VITE_KEYCLOAK_REALM=master \
     --build-arg VITE_KEYCLOAK_CLIENT_ID=xpos-client-api \
     -t xpos-ui:deploy-test .
   ```

3. **Deploy `.env`**
   ```
   XPOS_IMAGE=xpos:deploy-test
   XPOS_UI_IMAGE=xpos-ui:deploy-test
   XPOS_PORT=9004
   XPOS_UI_PORT=8081
   # (other vars from .env.example)
   ```
   *Note: Ports 9004/8081 used due to host conflicts with 9003/80.*

### Results

| Step | Result |
|------|--------|
| `./deploy.sh down` | Success – all containers stopped |
| `./deploy.sh up` | Success – stack started |
| Postgres health | Healthy |
| Redis health | Healthy |
| Kafka health | Healthy (using `/opt/kafka/bin/kafka-broker-api-versions.sh`) |
| Keycloak health | Healthy (health check on port 9000) |
| xpos backend | Started; health endpoint returns `{"status":"UP"}` |
| xpos-ui frontend | Started; `/health` returns `ok` |
| `./deploy.sh status` | All 6 containers running |
| `./deploy.sh health` | Both backend and frontend reported healthy |

### Health Check Output

```
Backend health:
{"groups":["liveness","readiness"],"status":"UP"}
Frontend health:
ok
```

### Status Output

```
NAME                IMAGE                            STATUS                        PORTS
deploy-kafka-1      apache/kafka:3.9.0               Up (healthy)                   0.0.0.0:9093->9092/tcp
deploy-keycloak-1   quay.io/keycloak/keycloak:25.0   Up (healthy)                  0.0.0.0:8080->8080/tcp
deploy-postgres-1   postgres:16-alpine               Up (healthy)                   0.0.0.0:5433->5432/tcp
deploy-redis-1      redis:7-alpine                   Up (healthy)                  0.0.0.0:6380->6379/tcp
deploy-xpos-1       xpos:deploy-test                 Up                            0.0.0.0:9004->9003/tcp
deploy-xpos-ui-1    xpos-ui:deploy-test              Up                            0.0.0.0:8081->80/tcp
```

## Fixes Applied During Testing

1. **Kafka health check** – Use full path `/opt/kafka/bin/kafka-broker-api-versions.sh` (PATH may not include Kafka bin).
2. **Keycloak health check** – Health is served on management port **9000**, not 8080.
3. **Backend Kafka dependency** – Removed `optional=true` from `spring-kafka` in `pom.xml` so KafkaTemplate is available at runtime.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in `.env` (e.g. `XPOS_UI_PORT=8081`). |
| Backend exits with `ClassNotFoundException: KafkaTemplate` | Ensure `spring-kafka` is not `<optional>true</optional>` in `pom.xml`. |
| Keycloak never healthy | Verify health check uses port 9000. |
| Kafka unhealthy | Ensure health check uses `/opt/kafka/bin/kafka-broker-api-versions.sh`. |
| Frontend shows wrong API URL | Rebuild frontend image with correct `VITE_API_BASE_URL`. |

## Production Notes

- Use strong passwords for Postgres and Keycloak.
- Prefer external Keycloak/Postgres/Redis/Kafka in production.
- Configure Keycloak realm, client, and users before use.
- Run Flyway migrations on first startup (automatic).
