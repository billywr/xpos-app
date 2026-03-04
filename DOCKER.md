# XPOS UI Docker

Production-grade multi-stage Dockerfile: Node 20 Alpine build → nginx Alpine serve.

## CI (GitHub Actions)

On push to `main`/`master`, the workflow builds and pushes the image to GitHub Container Registry. See [.github/workflows/README-CI.md](.github/workflows/README-CI.md) for required repo configuration.

## Build

```bash
docker build -t xpos-ui:latest \
  --build-arg VITE_API_BASE_URL=https://api.example.com \
  --build-arg VITE_KEYCLOAK_URL=https://auth.example.com \
  --build-arg VITE_KEYCLOAK_REALM=xpos \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=xpos-client-api \
  .
```

**Build args** (baked into the bundle at build time):
- `VITE_API_BASE_URL` – Backend API base URL (no trailing slash)
- `VITE_KEYCLOAK_URL` – Keycloak base URL
- `VITE_KEYCLOAK_REALM` – Keycloak realm
- `VITE_KEYCLOAK_CLIENT_ID` – Keycloak client ID

## Run

```bash
docker run -d -p 80:80 --name xpos-ui xpos-ui:latest
```

Serves the SPA on port 80. Health check: `GET /health` returns 200.
