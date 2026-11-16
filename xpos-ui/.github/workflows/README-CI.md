# GitHub Actions CI/CD – Docker Build, Push & SSH Deploy

The workflow in `.github/workflows/docker-build-push.yml`:

1. **Build and Push** – Builds the XPOS UI Docker image and pushes it to **GitHub Container Registry (ghcr.io)** with `latest`, `dev`, branch name, and short git SHA.
2. **Deploy to Server** – Connects to the remote server via SSH and redeploys the `xpos-ui` service in `/app`.

Build and push runs on every push and pull request to `main` or `master`. The deployment job runs only on pushes to `main` or `master` (and manual `workflow_dispatch`).

## What You Need to Configure in GitHub

### 1. **Actions permissions**

- Go to **Settings → Actions → General**
- Under **Workflow permissions**, choose:
  - **Read and write permissions** (to allow writing packages to ghcr.io)

### 2. **Repository Secrets for SSH Deployment & Production Build**

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Description | Example |
|---|---|---|
| `SSH_HOST` | Remote server IP / hostname | `62.169.22.51` |
| `SSH_USER` | SSH username | `root` |
| `SSH_PASSWORD` | SSH password or passphrase | *(your SSH password)* |
| `VITE_API_BASE_URL` | Backend API base URL (baked at build) | `http://api.xpos.com:9005` |
| `VITE_KEYCLOAK_URL` | Keycloak base URL (baked at build) | `http://auth.xpos.com:8088` |

### 3. **Repository variables (optional)**

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_KEYCLOAK_REALM` | `xpos` | Keycloak realm |
| `VITE_KEYCLOAK_CLIENT_ID`| `xpos-client-api` | Keycloak client |

### 4. **Package visibility (optional)**

- After the first successful run, the image appears under **Packages**
- In **Packages** → image → **Package settings**, you can change visibility (public/private)

### 5. **Branch names**

The workflow runs on pushes to `main` and `master`.

---

## Remote Deployment Details

The `deploy-ui` job executes the following commands on the remote server:

```bash
cd /app
docker compose pull xpos-ui
docker compose up -d --no-deps xpos-ui
docker image prune -f
docker compose ps xpos-ui
```

## Image location

- **Registry:** `ghcr.io`
- **Image:** `ghcr.io/<your-org-or-user>/xpos-ui`
- **Tags:** `latest`, `dev`, branch name, short git SHA

