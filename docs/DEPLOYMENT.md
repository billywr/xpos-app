# XPOS Deployment Guide

Deploy XPOS (frontend + backend) on a machine where **Docker, Postgres, Redis, Kafka, and Keycloak are already running**. The deploy process only starts the xpos and xpos-ui containers and connects them to the existing infrastructure.

## Prerequisites

### Already Running on Host

- **PostgreSQL** (e.g. port 5432)
- **Redis** (e.g. port 6379)
- **Kafka** (e.g. port 9092)
- **Keycloak** (e.g. port 8080)

### Required for Deploy

- **Docker** and **Docker Compose** v2
- **curl** (for health checks)
- **nc** (optional, for `./deploy.sh check`)

Ports **9003** and **80** must be free for xpos and xpos-ui (or configure via `.env`).

## Quick Start

```bash
# 1. Ensure Postgres, Redis, Kafka, Keycloak are running on the host

# 2. Enter deploy directory
cd xpos/deploy

# 3. Create .env from example and configure connection details
cp .env.example .env
# Edit .env: image names, Postgres/Redis/Kafka/Keycloak URLs, credentials

# 4. Verify prerequisites (optional)
./deploy.sh check

# 5. Deploy
./deploy.sh up
```

When ready:

```
XPOS is ready:
  Frontend: http://localhost:80
  Backend:  http://localhost:9003
```

## Deployment Artifacts

| File | Purpose |
|------|---------|
| `deploy/docker-compose.deploy.yml` | Compose stack (xpos + xpos-ui only) |
| `deploy/.env.example` | Example configuration (copy to `.env`) |
| `deploy/deploy.sh` | Script: up, down, status, health, check, logs |

## Configuration

### Required Environment Variables (`.env`)

| Variable | Description |
|----------|-------------|
| `XPOS_IMAGE` | Backend image (e.g. `ghcr.io/myorg/xpos:latest`) |
| `XPOS_UI_IMAGE` | Frontend image (e.g. `ghcr.io/myorg/xpos-ui:latest`) |
| `POSTGRES_PASSWORD` | Postgres password |
| `XPOS_KEYCLOAK_JWK_URI` | Full JWK URI (e.g. `http://host.docker.internal:8080/realms/master/protocol/openid-connect/certs`) |

### External Services (Host Reachability)

Containers reach host services via `host.docker.internal` (Docker 20.10+ provides `host-gateway`). Override if services run elsewhere:

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | Postgres host (for container) | `host.docker.internal` |
| `POSTGRES_PORT` | Postgres port | `5432` |
| `POSTGRES_USER` | Postgres user | `postgres` |
| `POSTGRES_DB` | Postgres database | `xpos` |
| `REDIS_HOST` | Redis host | `host.docker.internal` |
| `REDIS_PORT` | Redis port | `6379` |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka bootstrap (host:port) | `host.docker.internal:9092` |

### Ports for xpos and xpos-ui

| Variable | Description | Default |
|----------|-------------|---------|
| `XPOS_PORT` | Host port for backend | `9003` |
| `XPOS_UI_PORT` | Host port for frontend | `80` |

### Frontend Build-Time Variables

The frontend image must be built with URLs matching your deployment:

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:9003 \
  --build-arg VITE_KEYCLOAK_URL=http://localhost:8080 \
  --build-arg VITE_KEYCLOAK_REALM=master \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=xpos-client-api \
  -t xpos-ui:latest .
```

## Deploy Script Commands

| Command | Description |
|---------|-------------|
| `./deploy.sh check` | Verify Postgres, Redis, Kafka, Keycloak are reachable |
| `./deploy.sh up` | Start xpos + xpos-ui, wait for backend health |
| `./deploy.sh down` | Stop and remove containers |
| `./deploy.sh status` | Show container status |
| `./deploy.sh health` | Curl backend and frontend health endpoints |
| `./deploy.sh logs [service]` | Tail logs (optional: xpos or xpos-ui) |

## Architecture

```
  Host machine (Postgres, Redis, Kafka, Keycloak already running)
  ─────────────────────────────────────────────────────────────

    ┌─────────────────────────────────────────────────────┐
    │  Docker                                              │
    │                                                     │
    │    ┌─────────────┐         ┌─────────────────────┐  │
    │    │  xpos-ui    │  :80    │       xpos          │  │  :9003
    │    │  (Nginx)    │────────▶│  (Spring Boot)      │  │
    │    └─────────────┘         └──────────┬──────────┘  │
    │                                       │             │
    │                         host.docker.internal        │
    └───────────────────────────────────────┼─────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
              ┌─────▼─────┐           ┌──────▼──────┐         ┌─────▼─────┐
              │ Postgres  │           │   Redis     │         │   Kafka   │
              │  :5432    │           │   :6379    │         │   :9092  │
              └───────────┘           └────────────┘         └──────────┘
                                                    │
                                              ┌─────▼─────┐
                                              │ Keycloak  │  :8080
                                              └───────────┘
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `host.docker.internal` not resolved | Use Docker 20.10+; Linux uses `host-gateway` in `extra_hosts`. |
| `./deploy.sh check` fails | Ensure Postgres, Redis, Kafka, Keycloak listen on expected ports. Use `KEYCLOAK_HOST`, `KEYCLOAK_PORT` if Keycloak is not on localhost:8080. |
| Backend cannot connect to Postgres | Verify `POSTGRES_HOST`, `POSTGRES_PORT`, credentials. For same-host, `host.docker.internal` maps to host. |
| Backend exits with `ClassNotFoundException: KafkaTemplate` | Ensure `spring-kafka` is not `<optional>true</optional>` in `pom.xml`. |
| Frontend shows wrong API URL | Rebuild frontend image with correct `VITE_API_BASE_URL`. |

## Production Notes

- Use strong passwords and TLS for Postgres, Redis, Kafka, Keycloak.
- If services run on different hosts, set `POSTGRES_HOST`, `REDIS_HOST`, `KAFKA_BOOTSTRAP_SERVERS`, and `XPOS_KEYCLOAK_JWK_URI` to the actual endpoints.
- Configure Keycloak realm, client, and users before use.
- Flyway migrations run automatically on first backend startup.
