# Compose snippet for xpos-ui

Quick reference for wiring **xpos-ui** into your own Docker Compose. For full deployment flow and troubleshooting, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Port mapping

- Nginx listens on **port 80** inside the container.
- Map host 9011 → container 80: use **`"9011:80"`** (not `9011:9011`).

---

## Keycloak in the same compose

When Keycloak is a **service** in the same stack (e.g. `keycloak`), set the proxy to that service and its **container port** (8080):

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

Use your actual Keycloak **service name** (e.g. `keycloak-common:8080`).  
If you omit `KEYCLOAK_PROXY_PASS`, nginx may fail with **"host not found in upstream host.docker.internal"** because that hostname is not available in a typical compose network.

---

## Keycloak on the host (not in compose)

When Keycloak runs on the **host** (e.g. port 8088), add `extra_hosts` and point the proxy at the host:

```yaml
xpos-ui:
  image: ghcr.io/billywr/xpos-ui:dev
  ports:
    - "9011:80"
  extra_hosts:
    - "host.docker.internal:host-gateway"
  environment:
    KEYCLOAK_PROXY_PASS: host.docker.internal:8088
  # ... rest of service config
```

---

## See also

- **[DEPLOYMENT.md](DEPLOYMENT.md)** – full deployment guide, two deployment models, custom domain, and troubleshooting (CORS, proxy, ports, envsubst, etc.).
