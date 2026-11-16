# XPOS Docker

Production-grade Dockerfiles for XPOS backend and frontend.

## CI (GitHub Actions)

On push to `main`/`master`, the workflow builds and pushes the image to GitHub Container Registry. See [.github/workflows/README-CI.md](.github/workflows/README-CI.md) for required repo configuration.

## Images

### Backend (`xpos`)

Multi-stage build: Maven → Eclipse Temurin 21 JRE Alpine.

```bash
docker build -t xpos:latest .
```

**Runtime**: Non-root user, port 9003, `SPRING_PROFILES_ACTIVE=prod`.

**Required env** (override defaults):
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `SPRING_KAFKA_BOOTSTRAP_SERVERS`
- `XPOS_KEYCLOAK_JWK_URI` (e.g. `https://keycloak.example.com/realms/xpos/protocol/openid-connect/certs`)

### Frontend (`xpos-ui`)

Multi-stage build: Node 20 → nginx Alpine.

```bash
docker build -t xpos-ui:latest \
  --build-arg VITE_API_BASE_URL=https://api.example.com \
  --build-arg VITE_KEYCLOAK_URL=https://auth.example.com \
  --build-arg VITE_KEYCLOAK_REALM=xpos \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=xpos-client-api \
  .
```

**Runtime**: nginx serves static assets on port 80. Use a reverse proxy in front for TLS.

## Local test with Docker Compose

Full stack (Postgres, Kafka, Keycloak, XPOS):

```bash
docker compose -f docker-compose.yml up -d
```

**Note**: If port 5432 is in use, edit `docker-compose.yml` to use e.g. `5433:5432` for Postgres.

Wait for services to be healthy (~60s), then:

```bash
curl http://localhost:9003/actuator/health
```

Stop:

```bash
docker compose -f docker-compose.yml down
```

## Frontend standalone test

```bash
docker run -d -p 8080:80 --name xpos-ui xpos-ui:test
curl http://localhost:8080/health
```
