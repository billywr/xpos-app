# GitHub Actions CI – Docker Build & Push

The workflow in `.github/workflows/docker-build-push.yml` builds the XPOS UI Docker image and pushes it to **GitHub Container Registry (ghcr.io)** when code is pushed to `main` or `master`.

## What You Need to Configure in GitHub

### 1. **Actions permissions**

- Go to **Settings → Actions → General**
- Under **Workflow permissions**, choose:
  - **Read and write permissions**

### 2. **Secrets (optional – for production-ready images)**

The frontend bakes API and Keycloak URLs at build time. To build images that work in production, add:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret                  | Example value               | Purpose                           |
|-------------------------|-----------------------------|-----------------------------------|
| `VITE_API_BASE_URL`     | `https://api.example.com`   | Backend API base URL (no slash)   |
| `VITE_KEYCLOAK_URL`     | `https://auth.example.com`  | Keycloak base URL                 |

If these are not set, the build still runs, but the app will have empty URLs and cannot reach the backend or auth in production. For dev/staging images you can leave them empty.

### 3. **Repository variables (optional)**

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| Variable                 | Default   | Purpose          |
|--------------------------|-----------|------------------|
| `VITE_KEYCLOAK_REALM`    | (empty)   | Keycloak realm   |
| `VITE_KEYCLOAK_CLIENT_ID`| (empty)   | Keycloak client  |

If unset, the Dockerfile defaults (`xpos`, `xpos-client-api`) are used.

### 4. **Package visibility (optional)**

- After the first successful run, the image appears under **Packages**
- In **Packages** → image → **Package settings**, you can change visibility (public/private)

### 5. **Branch names**

The workflow runs on pushes to `main` and `master`. If your default branch is different, add it in the workflow:

```yaml
on:
  push:
    branches: [main, master]
```

---

## Image location

- **Registry:** `ghcr.io`
- **Image:** `ghcr.io/<your-org>/<repo-name>`
  - Example: `ghcr.io/blinc/xpos-ui`
- **Tags:** `latest` (on main/master), branch name, git SHA

## Pull the image

```bash
docker pull ghcr.io/<your-org>/<repo-name>:latest
```
