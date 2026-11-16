# GitHub Actions CI/CD – Docker Build, Push & SSH Deploy

The workflow in `.github/workflows/docker-build-push.yml`:

1. **Build and Push** – Builds the XPOS backend Docker image and pushes it to **GitHub Container Registry (ghcr.io)** with `latest`, `dev`, branch name, and short git SHA.
2. **Deploy to Server** – Connects to the remote server via SSH and redeploys the `xpos-api` service in `/app`.

Build and push runs on every push and pull request to `main` or `master`. The deployment job runs only on pushes to `main` or `master` (and manual `workflow_dispatch`).

## What You Need to Configure in GitHub

### 1. **Actions permissions**

- Go to **Settings → Actions → General**
- Under **Workflow permissions**, choose:
  - **Read and write permissions** (to allow writing packages to ghcr.io)

### 2. **Repository Secrets for SSH Deployment**

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Description | Example |
|---|---|---|
| `SSH_HOST` | Remote server IP / hostname | `62.169.22.51` |
| `SSH_USER` | SSH username | `root` |
| `SSH_PASSWORD` | SSH password or passphrase | *(your SSH password)* |

### 3. **Package visibility (optional)**

- After the first successful run, the image appears under **Packages** in the repo (or org)
- Go to **Packages** → select the image → **Package settings** → adjust visibility (public/private) if needed

### 4. **Branch names**

The workflow runs on pushes to `main` and `master`.

---

## Remote Deployment Details

The `deploy-api` job executes the following commands on the remote server:

```bash
cd /app
docker compose pull xpos-api
docker compose up -d --no-deps xpos-api
docker image prune -f
docker compose ps xpos-api
```

## Image location

- **Registry:** `ghcr.io`
- **Image:** `ghcr.io/<your-org-or-user>/xpos`
- **Tags:** `latest`, `dev`, branch name, short git SHA

