# XPOS Deployment Guide

Deploy XPOS (frontend + backend) on a machine where **Docker, Postgres, Redis, Kafka, and Keycloak are already running**. The deploy process only starts the xpos and xpos-ui containers and connects them to the existing infrastructure.

## Prerequisites

### Already Running on Host

- **PostgreSQL** (e.g. port 5432)
- **Redis** (e.g. port 6379)
- **Kafka** (e.g. port 9092)
- **Keycloak** (e.g. port 8080 or 8088 on host)

### Required for Deploy

- **Docker** and **Docker Compose** v2
- **curl** (for health checks)
- **nc** (optional, for `./deploy.sh check`)

Ports **9003** and **9011** must be free for xpos and xpos-ui (or configure via `.env`).

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
  Frontend: http://localhost:9011
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
| `XPOS_KEYCLOAK_JWK_URI` | Full JWK URI (e.g. `http://host.docker.internal:8088/realms/xpos/protocol/openid-connect/certs`; use your Keycloak host port) |

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
| `XPOS_UI_PORT` | Host port for frontend | `9011` |

### Frontend Build-Time Variables

The frontend image bakes in API and Keycloak URLs at build time. The **xpos-ui** Dockerfile hardcodes defaults for `xpos.com` (see `xpos-ui/Dockerfile` and `xpos-ui/.env.production`). To override, rebuild with:

```bash
docker build -t xpos-ui:latest \
  --build-arg VITE_API_BASE_URL=http://api.xpos.com:9003 \
  --build-arg VITE_KEYCLOAK_URL=http://auth.xpos.com:8088 \
  --build-arg VITE_KEYCLOAK_REALM=master \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=xpos-client-api \
  .
```

Use the **Keycloak host port** (e.g. 8088 if Keycloak is mapped to 8088 on the host).

## Local testing with custom domain (e.g. xpos.com)

To test using hostnames like `xpos.com` instead of `localhost`, point those names at your machine via `/etc/hosts`, then build/run the frontend so it calls `api.xpos.com` and `auth.xpos.com` (with the correct ports).

### 1. Edit hosts (Ubuntu/Linux)

```bash
sudo nano /etc/hosts
```

Add at the end (adjust subdomains if needed):

```
127.0.0.1   xpos.com
127.0.0.1   api.xpos.com
127.0.0.1   auth.xpos.com
```

Save (Ctrl+O, Enter) and exit (Ctrl+X).

### 2. Reload / apply changes

- **Usually no reload needed.** The resolver reads `/etc/hosts` on each lookup.
- If hostnames don’t resolve, flush the cache and use a **new browser tab**:
  ```bash
  sudo systemd-resolve --flush-caches
  ```
  Or on newer systems: `sudo resolvectl flush-caches`

### 3. Ports (use in URLs and frontend build)

- **Frontend:** `http://xpos.com:9011`
- **Backend:** `http://api.xpos.com:9003` (or your backend host port)
- **Keycloak:** `http://auth.xpos.com:8088` (or your Keycloak host port, e.g. 8088 not 8080 if that’s how it’s mapped)

Without the port, the browser uses port 80; your containers won’t be reached unless you use a reverse proxy on 80.

### 4. Keycloak: same-origin proxy (recommended, no CORS)

So the browser can call Keycloak from `http://xpos.com:9011`, configure the Keycloak client used by the app:

1. **Keycloak Admin** → realm (e.g. **xpos**) → **Clients** → your client (e.g. **xpos-client-api**) → **Settings**.
2. If **Valid redirect URIs** and **Web origins** are missing (Keycloak 25 with only “Direct access grants”): enable **Standard flow** temporarily, **Save**, then the fields appear.
3. Set:
   - **Valid redirect URIs:** `http://xpos.com:9011/*`
   - **Web origins:** `http://xpos.com:9011` (or `+` to use redirect URIs as origins)
4. **Save**. Restart Keycloak if CORS still fails: `docker restart <keycloak-container>`.

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
    │    │  xpos-ui    │ :9011   │       xpos          │  │  :9003
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
                                              │ Keycloak  │  :8080 (or :8088 on host)
                                              └───────────┘
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `host.docker.internal` not resolved | Use Docker 20.10+; Linux uses `host-gateway` in `extra_hosts`. |
| `./deploy.sh check` fails | Ensure Postgres, Redis, Kafka, Keycloak listen on expected ports. Set `KEYCLOAK_HOST`, `KEYCLOAK_PORT` in `.env` if Keycloak is not on localhost:8080 (e.g. use 8088). |
| Backend cannot connect to Postgres | Verify `POSTGRES_HOST`, `POSTGRES_PORT`, credentials. For same-host, `host.docker.internal` maps to host. |
| Backend exits with `ClassNotFoundException: KafkaTemplate` | Ensure `spring-kafka` is not `<optional>true</optional>` in `pom.xml`. |
| Frontend shows wrong API URL or “missing VITE_KEYCLOAK_URL” | Rebuild frontend image; URLs are baked in at build time. See Frontend Build-Time Variables and `xpos-ui/Dockerfile`. |
| CORS blocking Keycloak token from xpos.com:9011 | **Preferred:** Use the frontend’s **same-origin Keycloak proxy**. The app is built with `VITE_USE_KEYCLOAK_PROXY=true`; nginx proxies `/keycloak/` to Keycloak. Run the frontend container with `extra_hosts: host.docker.internal:host-gateway` (see `compose-frontend.yml`) so the proxy can reach Keycloak on the host (e.g. port 8088). No Keycloak CORS config needed. **Alternative:** In Keycloak client set Web origins to `http://xpos.com:9011`, enable **Standard flow**, save, restart Keycloak. |
| auth.xpos.com:8080 not reachable | Use the host port Keycloak is actually on (e.g. **8088**). In frontend Dockerfile / build use `VITE_KEYCLOAK_URL=http://auth.xpos.com:8088`. Ensure `/etc/hosts` has `127.0.0.1 auth.xpos.com`. |

## Production Notes

- Use strong passwords and TLS for Postgres, Redis, Kafka, Keycloak.
- If services run on different hosts, set `POSTGRES_HOST`, `REDIS_HOST`, `KAFKA_BOOTSTRAP_SERVERS`, and `XPOS_KEYCLOAK_JWK_URI` to the actual endpoints.
- Configure Keycloak realm, client, and users before use. For a custom domain (e.g. xpos.com), set the client’s **Valid redirect URIs** and **Web origins** to your frontend URL so CORS works.
- Flyway migrations run automatically on first backend startup.
