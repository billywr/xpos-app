# XPOS Deployment Guide

This guide explains how to deploy the XPOS frontend and backend so that anyone can run and troubleshoot the stack.

---

## Table of contents

1. [How deployment works](#1-how-deployment-works)
2. [Ways to deploy](#2-ways-to-deploy)
3. [Full compose (Keycloak + xpos in one stack)](#3-full-compose-keycloak--xpos-in-one-stack)
4. [Deploy stack (external Postgres, Redis, Kafka, Keycloak)](#4-deploy-stack-external-postgres-redis-kafka-keycloak)
5. [Custom domain (e.g. xpos.com)](#5-custom-domain-eg-xposcom)
6. [Troubleshooting](#6-troubleshooting)
7. [Reference](#7-reference)

---

## 1. How deployment works

- **Backend (xpos-api):** Spring Boot app. Needs PostgreSQL, Redis, Kafka, and Keycloak. Exposed on a host port (e.g. 9005).
- **Frontend (xpos-ui):** Static SPA served by nginx. The app calls the backend API and Keycloak for login. Exposed on a host port (e.g. 9011).
- **Login:** The UI uses Keycloak’s “password” grant. To avoid browser CORS issues, the frontend image can **proxy** Keycloak at `/keycloak`, so the browser only talks to the frontend origin (same-origin). Nginx then forwards `/keycloak/` to the real Keycloak server.

**Important:** The frontend is built with API and Keycloak URLs **baked in** at build time. The Keycloak proxy target is set at **runtime** via the `KEYCLOAK_PROXY_PASS` environment variable.

---

## 2. Ways to deploy

| Scenario | When to use |
|----------|-------------|
| **Full compose** | Keycloak, Postgres, Redis, Kafka, xpos-api, and xpos-ui all in one Docker Compose file. |
| **Deploy stack** | Postgres, Redis, Kafka, Keycloak already run on the host; you only start xpos and xpos-ui with `deploy/docker-compose.deploy.yml` and `deploy/deploy.sh`. |

The rest of this doc covers both and the main pitfalls.

---

## 3. Full compose (Keycloak + xpos in one stack)

Use this when Keycloak and xpos run as **services in the same Docker Compose** (e.g. shared network).

### 3.1 Backend (xpos-api)

- Image: your backend image (e.g. `${XPOS_IMAGE}`).
- Port: e.g. `9005:9005` (host 9005 → container 9005).
- Environment: point to Postgres, Redis, Kafka, and Keycloak by **service name** (e.g. `postgres-common:5432`, `redis-common:6379`, `kafka-common:9092`, `XPOS_KEYCLOAK_JWK_URI` with Keycloak’s internal URL, e.g. `http://keycloak:8080/realms/xpos/protocol/openid-connect/certs`).
- Healthcheck: e.g. `wget` or `curl` to `http://127.0.0.1:9005/actuator/health`.

### 3.2 Frontend (xpos-ui) – critical settings

**Port mapping**

- Nginx **inside** the container listens on **port 80**.
- Map the **host** port (e.g. 9011) to **container port 80**:
  ```yaml
  ports:
    - "9011:80"
  ```
- Using `"9011:9011"` is wrong: nothing listens on 9011 in the container, so the frontend will be unreachable.

**Keycloak proxy (avoids CORS)**

- The image proxies Keycloak at `/keycloak`. The browser calls `http://your-host:9011/keycloak/...` (same origin), so Keycloak CORS is not needed.
- Nginx needs to know **where Keycloak is**. That is set with **`KEYCLOAK_PROXY_PASS`** at runtime.

When Keycloak is a **service in the same compose** (e.g. service name `keycloak`):

- Use the **service name** and the **port inside the Keycloak container** (Keycloak listens on **8080** inside the container).
- Compose port mapping `"8088:8080"` means: host 8088 → container 8080. **Container-to-container** traffic uses the **container port**, so use **8080**:
  ```yaml
  environment:
    KEYCLOAK_PROXY_PASS: keycloak:8080
  ```
- **Why 8080 and not 8088?** 8088 is only the **host** port. From another container you talk to `keycloak:8080` (service name + port the process listens on inside the container).

If you **omit** `KEYCLOAK_PROXY_PASS`, the entrypoint defaults to `host.docker.internal:8088`. That hostname often does **not** exist in a typical compose network, so nginx fails with:

```text
host not found in upstream "host.docker.internal" in /etc/nginx/conf.d/default.conf
```

So when Keycloak is in the same compose, **always** set:

```yaml
KEYCLOAK_PROXY_PASS: keycloak:8080
```

(Replace `keycloak` with your Keycloak service name if different, e.g. `keycloak-common:8080`.)

### 3.3 Example xpos-ui block (full compose)

```yaml
xpos-ui:
  image: ghcr.io/billywr/xpos-ui:dev
  container_name: xpos-ui
  pull_policy: always
  ports:
    - "9011:80"
  environment:
    KEYCLOAK_PROXY_PASS: keycloak:8080
  depends_on:
    xpos-api:
      condition: service_healthy
  networks:
    - internal-srv-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD-SHELL", "curl -sf http://localhost/health || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 3
```

After deploy, open the app at **http://localhost:9011** (or your host/IP and port).

---

## 4. Deploy stack (external Postgres, Redis, Kafka, Keycloak)

Use this when Postgres, Redis, Kafka, and Keycloak already run **on the host** (or elsewhere). Only xpos and xpos-ui are started via the deploy stack.

- Copy `deploy/.env.example` to `deploy/.env` and set image names, `POSTGRES_PASSWORD`, `XPOS_KEYCLOAK_JWK_URI`, etc.
- Run: `./deploy.sh up` (from `xpos/deploy`).
- Frontend default port: 9011. Backend default: 9003 (overridable via `.env`).

When Keycloak is **on the host** (e.g. port 8088), the xpos-ui container must resolve `host.docker.internal` to reach it. Add to the **xpos-ui** service in your compose (or use `deploy/docker-compose.deploy.yml`, which is set up for host services):

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
environment:
  KEYCLOAK_PROXY_PASS: host.docker.internal:8088
```

Then the proxy target is the host’s Keycloak on port 8088.

---

## 5. Custom domain (e.g. xpos.com)

To use a hostname like `xpos.com` instead of `localhost` (e.g. for testing or a custom domain):

1. **Edit hosts (Ubuntu/Linux):**
   ```bash
   sudo nano /etc/hosts
   ```
   Add (adjust if you use different names):
   ```text
   127.0.0.1   xpos.com
   127.0.0.1   api.xpos.com
   127.0.0.1   auth.xpos.com
   ```
   Save and exit.

2. **Apply changes:** Usually no reload is needed. If the new hostnames don’t resolve, flush the resolver cache and try in a new browser tab:
   ```bash
   sudo systemd-resolve --flush-caches
   # or
   sudo resolvectl flush-caches
   ```

3. **Use the port in the URL:** The frontend is on port 9011, so open:
   - **http://xpos.com:9011**
   Without the port, the browser uses 80 and won’t reach your container unless you put a reverse proxy on 80.

4. **Backend / Keycloak ports:** Use the ports your backend and Keycloak are actually on (e.g. backend 9005, Keycloak 8088 on the host). The frontend image is built with those URLs (see `xpos-ui/Dockerfile` and build args).

---

## 6. Troubleshooting

Problems we hit and how to fix them.

### Frontend not reachable / blank page

| Cause | Fix |
|-------|-----|
| Wrong port mapping | Nginx listens on **80** in the container. Use **`9011:80`**, not `9011:9011`. |
| Container exiting on start | Check `docker logs xpos-ui`. If you see “host not found in upstream” → set `KEYCLOAK_PROXY_PASS` (see below). If you see “envsubst: not found” → rebuild the image (Dockerfile should install `gettext-envsubst`). |

### "crypto.randomUUID is not a function" (red error on page)

- **Meaning:** The browser or context (e.g. HTTP production) does not provide `crypto.randomUUID()`, which the app uses for request IDs and toast IDs.
- **Fix:** The frontend uses a safe UUID helper (`src/utils/uuid.ts`) that falls back to `crypto.getRandomValues()` or a random fallback when `crypto.randomUUID` is missing. Ensure you deploy a build that includes this (current codebase). Rebuild and redeploy the xpos-ui image if you were on an older build.

### “host not found in upstream” (host.docker.internal)

- **Meaning:** Nginx is trying to proxy to `host.docker.internal:8088` but that hostname doesn’t resolve inside the container.
- **When Keycloak is in the same compose:** Set the proxy to the Keycloak **service** and **container port**:
  ```yaml
  environment:
    KEYCLOAK_PROXY_PASS: keycloak:8080
  ```
  Use your real Keycloak service name; use **8080** (container port), not 8088 (host port).
- **When Keycloak is on the host:** Add `extra_hosts: - "host.docker.internal:host-gateway"` to the xpos-ui service and keep `KEYCLOAK_PROXY_PASS: host.docker.internal:8088` (or whatever port Keycloak uses on the host).

### Why 8080 vs 8088 for Keycloak?

- **8088** = port on the **host** (e.g. `ports: "8088:8080"`).
- **8080** = port **inside** the Keycloak container.
- From **another container** you must use the **service name + container port**: `keycloak:8080`. Using `keycloak:8088` is wrong because nothing listens on 8088 inside the Keycloak container.

### “Login is not configured (missing VITE_KEYCLOAK_URL)”

- The frontend reads `VITE_KEYCLOAK_URL` at **build time**. If the image was built without it (or with an empty value), you get this error.
- **Fix:** Rebuild the frontend image so the Dockerfile (or build args) set `VITE_KEYCLOAK_URL` and related vars. The repo Dockerfile hardcodes defaults (e.g. `http://auth.xpos.com:8088`). Rebuild and redeploy the image.

### CORS blocking Keycloak token request

- **Preferred:** Use the **same-origin proxy**. The image is built with `VITE_USE_KEYCLOAK_PROXY=true`; the browser calls `http://your-host:9011/keycloak/...` and nginx proxies to Keycloak. No CORS needed. Ensure `KEYCLOAK_PROXY_PASS` is set correctly (see above).
- **Alternative:** In Keycloak, open your client → Settings. Set **Valid redirect URIs** (e.g. `http://xpos.com:9011/*`) and **Web origins** (e.g. `http://xpos.com:9011`). In Keycloak 25, if those fields are hidden, enable **Standard flow** temporarily, save, set them, then save again. Restart Keycloak if needed.

### auth.xpos.com:8080 not reachable

- If Keycloak is on the host and mapped as **8088:8080**, use **8088** in URLs that you open from the **browser** (e.g. `http://auth.xpos.com:8088`). The frontend build (VITE_KEYCLOAK_URL) and `/etc/hosts` must match. Use **8080** only for **container-to-container** proxy (`KEYCLOAK_PROXY_PASS: keycloak:8080`).

### "Cannot reach server. Check that the backend is running and VITE_API_BASE_URL is correct."

- **Meaning:** The browser could not reach the backend API (e.g. "Failed to fetch"). The frontend shows this message and a **Reference** ID (requestId); keep that ID when reporting the issue.
- **Checks:**
  1. **Backend running:** Ensure the xpos-api container (or backend process) is up and healthy. Run `docker ps` or `./deploy.sh status` and check backend logs.
  2. **VITE_API_BASE_URL:** The API URL is **baked in at build time**. The browser calls whatever URL was set when the frontend image was built (e.g. `http://api.xpos.com:9005` or `http://localhost:9005`). If you use a custom domain, the URL must be reachable **from the user’s browser** (same machine or correct DNS/hosts).
  3. **Host and port:** Confirm the backend is listening on the host/port in that URL. For example, if the URL is `http://api.xpos.com:9005`, ensure the backend is exposed on port 9005 and that `api.xpos.com` resolves (e.g. `/etc/hosts` or DNS) to the host where the backend runs.
  4. **Network / CORS:** Requests go from the **browser** to the backend. Firewall, VPN, or CORS misconfiguration can block them. Backend CORS must allow the frontend origin **including port** (e.g. `http://xpos.com:9011`). If **Postman** can reach the API but the **browser** shows "Cannot reach server", add your frontend URL (e.g. `http://xpos.com:9011`) to `xpos.api.cors.allowed-origins` in `application-prod.yml` (or via env) and restart the backend.
- **Fix:** Rebuild the frontend image with the correct `VITE_API_BASE_URL` for your environment, then redeploy. If the backend runs on a different host/port than what was baked in, update the build and rebuild. For browser "Cannot reach server" while Postman works, add the frontend origin to CORS and restart the backend.

### 401 Unauthorized (backend can't validate token or no token sent)

- **Meaning:** The API returns 401 when calling admin/operator endpoints. Either no valid Bearer token is sent, or the backend cannot validate the token (wrong/unreachable Keycloak URLs or issuer mismatch).
- **Backend Keycloak URLs:** `XPOS_KEYCLOAK_JWK_URI` and `XPOS_KEYCLOAK_ISSUER` are used **by the backend** to validate JWTs. The backend must be able to **reach** the JWK URI from inside its container.
  - **Keycloak in the same Docker Compose:** Use the **service name and container port**, not `auth.xpos.com`:
    - `XPOS_KEYCLOAK_JWK_URI=http://keycloak:8080/realms/xpos/protocol/openid-connect/certs`
    - `XPOS_KEYCLOAK_ISSUER=http://keycloak:8080/realms/xpos`
    (Replace `keycloak` with your Keycloak service name if different.) The backend container often cannot resolve `auth.xpos.com`; using the service name fixes that.
  - **Keycloak on the host:** Use `http://host.docker.internal:8088/realms/xpos/...` and ensure the backend container has `extra_hosts: host.docker.internal:host-gateway`.
- **Issuer must match the token:** The JWT's `iss` claim must **exactly** match `XPOS_KEYCLOAK_ISSUER`. If users log in via the frontend proxy (`http://xpos.com:9011/keycloak`), Keycloak may set `iss` to `http://xpos.com:9011/keycloak/realms/xpos`. Then set `XPOS_KEYCLOAK_ISSUER=http://xpos.com:9011/keycloak/realms/xpos`. Decode your access token at [jwt.io](https://jwt.io) and set `XPOS_KEYCLOAK_ISSUER` to the exact `iss` value.
- **Postman:** You must send a valid token. Get one: `POST` to `http://auth.xpos.com:8088/realms/xpos/protocol/openid-connect/token` (or your Keycloak URL) with `grant_type=password`, `client_id=xpos-client-api`, `username`, `password`. Use the response's `access_token` in the request: `Authorization: Bearer <access_token>`. If you send a token and still get 401, the backend cannot validate it (fix JWK URI and issuer as above and restart the backend).

### Backend / other

| Issue | Fix |
|-------|-----|
| `./deploy.sh check` fails | Ensure Postgres, Redis, Kafka, Keycloak are reachable on the ports in `.env`. Set `KEYCLOAK_HOST` / `KEYCLOAK_PORT` if Keycloak is not on localhost:8080. |
| Backend `ClassNotFoundException: KafkaTemplate` | Ensure `spring-kafka` is not `<optional>true</optional>` in `pom.xml`. Rebuild backend image. |
| Wrong API URL in frontend | API URL is baked in at build time. Rebuild frontend with correct `VITE_API_BASE_URL` (e.g. `http://api.xpos.com:9005`). |

---

## 7. Reference

### Deploy script (when using deploy stack)

| Command | Description |
|---------|-------------|
| `./deploy.sh check` | Verify Postgres, Redis, Kafka, Keycloak are reachable |
| `./deploy.sh up` | Start xpos + xpos-ui, wait for backend health |
| `./deploy.sh down` | Stop and remove containers |
| `./deploy.sh status` | Container status |
| `./deploy.sh health` | Curl backend and frontend health |
| `./deploy.sh logs [service]` | Tail logs |

### Files

| File | Purpose |
|------|---------|
| `deploy/docker-compose.deploy.yml` | Compose for xpos + xpos-ui (external infra) |
| `deploy/.env.example` | Example env; copy to `.env` |
| `deploy/deploy.sh` | up / down / status / health / check / logs |
| `compose-frontend.yml` | Frontend-only compose (backend already running) |
| `docs/DEPLOYMENT_COMPOSE_SNIPPET.md` | Copy-paste xpos-ui block for your compose |

### Ports (typical)

| Service | Container port | Host port (example) |
|---------|----------------|---------------------|
| xpos-ui (nginx) | 80 | 9011 |
| xpos-api | 9005 | 9005 |
| Keycloak | 8080 | 8088 |

### Production notes

- Use strong passwords and TLS where appropriate.
- Configure Keycloak realm, client, and users. For custom domains, set the client’s **Valid redirect URIs** and **Web origins** if you are not using the `/keycloak` proxy.
- Flyway runs on first backend startup.
