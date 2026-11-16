---
description: XPOS monorepo layout — xpos backend + xpos-ui frontend, cross-repo commands and API contract
---

# XPOS Monorepo Guidelines

| Directory | Role | Stack |
|-----------|------|-------|
| `xpos/` | Backend API | Java 21, Spring Boot 4, PostgreSQL, Kafka, Keycloak |
| `xpos-ui/` | Frontend SPA | React, TypeScript, Vite, Tailwind |

XPOS is a control + accounting POS for Kenya — anti-leakage, accountability, auditability.

## ⚠️ Critical Rule: Live / Production Server Safety
- **The live server (e.g. `https://62.169.22.51:9005`, Keycloak `https://62.169.22.51:8443`, or any remote host) is a LIVE PRODUCTION SERVER.**
- **NEVER update anything on the live server.**
- **NEVER add new info or insert records into the live server (no POST/PUT/PATCH mutations).**
- **NEVER delete data from the live server (no DELETE/DROP/TRUNCATE).**
- **All mutating tests, schema migrations, and write operations must run strictly in local environments (Docker compose, localhost).**

## Full Stack

```bash
cd xpos && docker compose up -d
cd xpos-ui && npm run dev    # port 5173
```

## Per-Project Rules

- Backend: `xpos/.agents/rules/` (project.md + architecture.md) and `xpos/AGENTS.md`
- Frontend: `xpos-ui/.agents/rules/` (project.md + architecture.md) and `xpos-ui/AGENTS.md`

## Cross-Repo Guidelines

- API contract is the boundary — coordinate DTOs and error codes.
- Auth: Keycloak only; no custom login in either repo.
- Org scoping end-to-end: frontend sends orgId/branchId/terminalId; backend enforces ownership.
- Error codes: UPPER_SNAKE_CASE; frontend shows `message` + `requestId`.
- Frontend → backend via `VITE_API_BASE_URL` (e.g. `http://localhost:9003`).

## Request Flow

React page → `apiFetch()` (JWT + X-Request-Id) → Spring `/api/v1/...` → service (org validation) → repository → PostgreSQL. Writes may emit `OutboxEvent` → Kafka.

## Docs

- `xpos/docs/E2E_FULL_API_REFERENCE.md`
- `xpos/docs/IMPLEMENTATION_PLAN.md`
- `xpos/docs/FRONTEND_IMPLEMENTATION.md`
- `xpos/docs/TROUBLESHOOTING.md`
