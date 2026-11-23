# XPOS Monorepo Agent Guidelines

| Directory | Role | Stack |
|-----------|------|-------|
| [`xpos/`](file:///home/billy/data/internals/xpos-app/xpos) | Backend API | Java 21, Spring Boot 4, PostgreSQL, Keycloak |
| [`xpos-ui/`](file:///home/billy/data/internals/xpos-app/xpos-ui) | Frontend SPA | React 18+, TypeScript, Vite, Tailwind CSS |
| [`xpos-mobile/`](file:///home/billy/data/internals/xpos-app/xpos-mobile) | Mobile App (Expo) | React Native, Expo SDK, TypeScript, TanStack Query |

XPOS is a control + accounting POS for Kenya — anti-leakage, accountability, auditability.

---

## ⚠️ CRITICAL NON-NEGOTIABLE RULE: LIVE / PRODUCTION SERVER SAFETY

- **The live server (e.g. `https://62.169.22.51:9005`, Keycloak `https://62.169.22.51:8443`, or any deployed live host) is a LIVE PRODUCTION SERVER.**
- **NEVER update, modify, add, or delete ANY data on the live server.**
- **NO DATA MUTATIONS / WRITES**: Never execute POST, PUT, PATCH, or mutation requests/endpoints against the live production server (e.g. no creating records, inserting items, or altering entities).
- **NO DELETIONS**: Never execute DELETE requests, drops, or destructive operations against the live production server or its databases.
- **NO MIGRATIONS OR DDL**: Never run Flyway migrations, schema alterations, or database DDL against live production databases.
- **READ-ONLY INSPECTION ONLY**: Only safe, non-destructive read-only (GET) requests to inspect API response shapes are permitted if diagnosing contracts. Never touch or alter live production state.
- **ALL MUTATIONS MUST TARGET LOCAL**: All testing, database seeding, integration tests, and experimental mutations must run exclusively against local containers/services (e.g. local Docker compose on `http://localhost:9003`, Keycloak on `http://localhost:8088`, or local test SQLite).

---

## Full Stack Orchestration (User Reference Only)

```bash
# Start backend and supporting infrastructure (PostgreSQL, Keycloak)
cd xpos && docker compose up -d

# Or run root compose if configured
docker compose up -d

# Start frontend dev server
cd xpos-ui && npm run dev    # port 5173
```

> [!CAUTION]
> **Agent Execution Rule**:
> - Agents must **NEVER** run frontend dev servers (`npm run dev`) or backend servers (`mvn spring-boot:run`, `docker compose up`, etc.).
> - Agents may only verify changes using **unit tests** (`mvn test` / `mvn verify` for backend, `npm test` / `npx vitest run` for frontend) and type checking (`tsc -b`).
> - Always ask the user to test the application manually after completing changes.


---

## Per-Project Guidelines & Customizations

- **Backend Rules & Skills**: Located in [`xpos/AGENTS.md`](file:///home/billy/data/internals/xpos-app/xpos/AGENTS.md) and [`xpos/.agents/`](file:///home/billy/data/internals/xpos-app/xpos/.agents/)
- **Frontend Rules & Skills**: Located in [`xpos-ui/AGENTS.md`](file:///home/billy/data/internals/xpos-app/xpos-ui/AGENTS.md) and [`xpos-ui/.agents/`](file:///home/billy/data/internals/xpos-app/xpos-ui/.agents/)

---

## Cross-Repo Core Contract

1. **API Contract is the Boundary**: Coordinate DTOs, endpoint paths, and error codes between frontend and backend.
2. **Authentication (Keycloak IAM)**:
   - Keycloak is external IAM; never implement custom login/auth flows in either repo.
   - Frontend attaches Bearer JWT access token and generates `X-Request-Id` (UUID) per request.
   - Backend acts as an OAuth2 resource server and validates JWT `sub` as `iamUserId`.
3. **Multi-tenant Organization Scoping**:
   - Frontend sends `orgId`, `branchId`, `terminalId` as required by the endpoint.
   - Backend strictly enforces organization ownership on all database reads and writes.
4. **Error Handling Contract**:
   - Error codes are formatted in `UPPER_SNAKE_CASE`.
   - Error responses include: `code`, `message` (user-facing), `requestId`, and optional `details` (e.g. field validation errors).
   - Frontend displays backend `message` and includes `requestId` in error views/toasts.
5. **Frontend → Backend Connectivity**:
   - Configured via `VITE_API_BASE_URL` (default: `http://localhost:9003`).
6. **UI Naming Conventions (Sentence case)**:
   - All UI text, page titles, section headers, card titles, button labels, badge pills, and table headers across UI frontends MUST use sentence case: only the first letter of the first word is uppercase (e.g. "Net profit / loss", "Gross revenue", "Manage inventory").
   - Do NOT use Title Case or all-caps `uppercase` CSS classes, except for standard acronyms/proper nouns (e.g. "COGS", "KSH", "M-Pesa", "SKU", "POS").
7. **Circular Count Badges (No Counts in Brackets)**:
   - NEVER put counts inside parentheses/brackets (e.g. do NOT use `(5)`, `All (6)`, `Expenses (12)`).
   - Every time counts are displayed across the system (tabs, buttons, category pills, section headers), ALWAYS use a dedicated circular/pill count badge with its own distinct background color via the standard `<CountBadge count={n} variant="..." active={...} />` component (or `rounded-full` badge with dedicated background and text colors).

---

## Request Flow

$$\text{React Page} \xrightarrow{\text{apiFetch() [JWT + X-Request-Id]}} \text{Spring Boot /api/v1/...} \xrightarrow{\text{Service (Org Validation)}} \text{Repository} \xrightarrow{} \text{PostgreSQL}$$

---

## Documentation References

- Backend API: [`xpos/docs/E2E_FULL_API_REFERENCE.md`](file:///home/billy/data/internals/xpos-app/xpos/docs/E2E_FULL_API_REFERENCE.md)
- Backend Plan: [`xpos/docs/IMPLEMENTATION_PLAN.md`](file:///home/billy/data/internals/xpos-app/xpos/docs/IMPLEMENTATION_PLAN.md)
- Frontend Guide: [`xpos/docs/FRONTEND_IMPLEMENTATION.md`](file:///home/billy/data/internals/xpos-app/xpos/docs/FRONTEND_IMPLEMENTATION.md)
- Troubleshooting: [`xpos/docs/TROUBLESHOOTING.md`](file:///home/billy/data/internals/xpos-app/xpos/docs/TROUBLESHOOTING.md)
