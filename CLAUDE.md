# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This workspace contains two sibling projects for the XPOS system:

| Directory  | Role     | Stack                              |
|------------|----------|------------------------------------|
| `xpos/`    | Backend  | Java 21, Spring Boot 4, PostgreSQL, Keycloak |
| `xpos-ui/` | Frontend | React, TypeScript, Vite, Tailwind  |

## Project Context

XPOS is a production-grade, multi-vertical POS for Kenya (supermarkets, retail shops, pubs/bars, restaurants, hotels). It is a **control + accounting system** — anti-leakage, accountability, and auditability are first-class requirements, not just a cashier app.

## Repository Responsibilities

### `xpos/` — Backend API
- Spring Boot monolith exposing REST API under `/api/v1`
- Multi-tenant: scoped by Org → Branch → Terminal → Device → Staff
- Keycloak is the external IAM; the backend is a JWT resource server
- Database managed exclusively via Flyway migrations (no Hibernate DDL)
- See `xpos/CLAUDE.md` for full backend rules and architecture

### `xpos-ui/` — Frontend SPA
- React + TypeScript SPA built with Vite
- Authenticates via Keycloak (OIDC), attaches JWT to all API calls
- Communicates exclusively with the `xpos/` backend — no direct DB access
- See `xpos-ui/CLAUDE.md` for full frontend rules and conventions

## Common Commands

### Full Stack
```bash
cd xpos && docker compose up -d   # Start all infra + backend
cd xpos-ui && npm run dev         # Start frontend dev server (port 5173)
```

### Backend (`xpos/`)
```bash
cd xpos
./mvnw spotless:apply             # Auto-format (Google Java Format)
./mvnw clean compile              # Compile (MapStruct + Lombok)
./mvnw checkstyle:check           # Checkstyle validation
./mvnw test                       # Unit tests
./mvnw test -Psurefire-integration  # Unit + integration tests (Docker required)
./mvnw test -Dtest=SaleServiceTest  # Single test class
./mvnw test -Dtest=SaleServiceTest#shouldCreateSale  # Single test method
```

### Frontend (`xpos-ui/`)
```bash
cd xpos-ui
npm run dev                       # Vite dev server
npm run build                     # TypeScript check + production build
npm run lint                      # ESLint
npm run test                      # Vitest single run
npx vitest run src/features/admin/OrgsListPage.test.tsx  # Single test file
npm run test:e2e                  # Playwright (requires built app)
```

### Backend Verification Sequence (after every change)
1. `./mvnw spotless:apply` → 2. `./mvnw clean compile` → 3. `./mvnw checkstyle:check` → 4. `./mvnw test`

## Cross-Repo Guidelines

- **API contract is the boundary.** Frontend consumes the backend REST API. Coordinate on endpoint shape, request/response DTOs, and error codes when changing either side.
- **Auth is Keycloak.** Both repos rely on the same Keycloak realm. Do not implement auth logic in either repo beyond what Keycloak provides.
- **Org scoping flows end-to-end.** Frontend sends `orgId` (and `branchId`, `terminalId` where applicable) in path/query params. Backend enforces ownership — never skip org-scoping on either side.
- **Error codes are shared.** Backend returns UPPER_SNAKE_CASE error `code` fields. Frontend should handle and display these codes meaningfully.
- **Environment wiring:** `xpos-ui` points to `xpos` via `VITE_API_BASE_URL`. When running locally, ensure `xpos` is up before starting `xpos-ui`.

## End-to-End Data Flow

A typical request flows: **React page** → `apiFetch<T>()` (attaches JWT + X-Request-Id) → **Spring controller** (`/api/v1/...`) → **service** (validates org ownership) → **repository** (org-scoped query) → **Flyway-managed PostgreSQL**. Write operations may also create `OutboxEvent` rows in PostgreSQL for auditing.

Frontend state: Redux (auth + org context + cart) + TanStack React Query (server data, staleTime 60s) + React Context (theme, toasts).

Backend error responses include `code` (UPPER_SNAKE_CASE), `message` (user-facing), `requestId`, and optional `details`. Frontend maps these: 400→inline field errors, 401→redirect login, 403→permission screen, 409→show message verbatim, 5xx→generic + requestId.

## Documentation

- `xpos/docs/E2E_FULL_API_REFERENCE.md` — full API surface
- `xpos/docs/IMPLEMENTATION_PLAN.md` — backend phased plan
- `xpos/docs/FRONTEND_IMPLEMENTATION.md` — frontend ↔ backend integration guide
- `xpos/docs/TROUBLESHOOTING.md` — common issues and solutions
- `xpos/docs/E2E_POSTMAN_GUIDE.md` — Postman E2E testing flow
