# GitHub Actions CI – Test & Docker Build & Push

The workflow in `.github/workflows/docker-build-push.yml`:

1. **Test** – Runs all tests (unit + integration) and Checkstyle. Must succeed before build.
2. **Build and Push** – Builds the XPOS backend Docker image and pushes it to **GitHub Container Registry (ghcr.io)** when code is pushed to `main` or `master`.

Both jobs run on every push and pull request to `main` or `master`.

## What You Need to Configure in GitHub

### 1. **Actions permissions**

- Go to **Settings → Actions → General**
- Under **Workflow permissions**, choose:
  - **Read and write permissions** (or at least allow the workflow to write packages)

### 2. **Package visibility (optional)**

- After the first successful run, the image appears under **Packages** in the repo (or org)
- Go to **Packages** → select the image → **Package settings** → adjust visibility (public/private) if needed

### 3. **Branch names**

The workflow runs on pushes to `main` and `master`. If your default branch is different, update the workflow:

```yaml
on:
  push:
    branches: [main, master]  # Add your branch name
```

### 4. **Nothing else required**

- `GITHUB_TOKEN` is automatically provided; no extra secrets needed for pushing to ghcr.io.

---

## Image location

- **Registry:** `ghcr.io`
- **Image:** `ghcr.io/<your-org>/<repo-name>`
  - Example: `ghcr.io/blinc/xpos`
- **Tags:** `latest` (on main/master), branch name, git SHA

## Pull the image

```bash
docker pull ghcr.io/<your-org>/<repo-name>:latest
```
