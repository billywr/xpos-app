# Content for frontend project: `.cursor/rules/project.mdc`

Copy the section below into your React frontend repo at **`.cursor/rules/project.mdc`** (create the file and paste). This gives the AI and developers consistent rules for the XPOS React UI.

---

```markdown
---
description: Production React frontend for XPOS (multi-vertical POS for Kenya). Consumes XPOS REST API. Auth via Keycloak; org-scoped admin and operator flows.
globs: 
alwaysApply: true
---

# XPOS Frontend – Cursor rules

You are working on the **XPOS React frontend**: a production-grade UI for the XPOS backend (supermarkets, retail, pubs/bars, restaurants, hotels in Kenya). The backend is a Spring Boot REST API; auth is **Keycloak** (OAuth2/OIDC). This is a **control + accounting** system; the UI must reflect org/branch/terminal context and operator vs admin roles.

## Tech stack (mandatory)

- **React** (current LTS, hooks, function components)
- **Tailwind CSS** for styling (utility-first; no Bootstrap/MUI unless explicitly added)
- **Redux** (or Redux Toolkit) for global state (auth, org context, cart/sale, etc.)
- **TypeScript** preferred for type safety and API contracts
- **React Router** for routes
- **Fetch or axios** for API calls (base URL + auth header + error handling)

## Backend contract (do not deviate)

- **Base URL:** From env (e.g. `VITE_API_BASE_URL` or `REACT_APP_API_BASE_URL`). Default dev: `http://localhost:9003`.
- **API prefix:** All endpoints under `/api/v1`. Admin: `/api/v1/admin/...`. Operator: `/api/v1/operator/...`.
- **Auth:** Every request (except health) must send:
  - `Authorization: Bearer <access_token>` (Keycloak access token).
  - `Content-Type: application/json` for POST/PATCH/PUT with body.
- **Request ID:** Send `X-Request-Id: <uuid>` on requests for traceability; backend echoes it in response headers and error payloads.
- **Org scoping:** Admin and operator URLs include `orgId` (path or query). Operator URLs also use `branchId`, `terminalId` from context. Never call admin/operator endpoints without the correct org (and branch/terminal when required).

## Error handling (mandatory)

- Backend errors return JSON: `{ "code": string, "message": string, "requestId": string, "details": array?, "status": number, "path": string }`.
- **401:** Token missing/expired → redirect to login or refresh token.
- **403:** Forbidden → show “You don’t have permission” (no sensitive details).
- **404:** Not found → show resource-not-found message; use `requestId` for support.
- **409:** Conflict → show `message` (e.g. “An organization with this name already exists”).
- **400:** Validation → show `details` (field + message) next to form fields.
- Always surface `message` (and optionally `requestId`) to the user; never show raw stack traces or internal codes in production UI.

## State and data flow

- **Auth state:** Store access token (and refresh if used) securely; derive user identity (e.g. `sub` = iamUserId) from token or from `GET /api/v1/me?orgId=...`.
- **Org context:** After login, user selects or is assigned an org; store `orgId` (and for operator: `branchId`, `terminalId`) in Redux. All API calls that need org must use this context.
- **Pagination:** List endpoints return `{ content: [], totalElements, totalPages, size, number }`. Use `page` and `size` query params; respect backend limits (e.g. max size 100).
- **Ids:** All IDs are UUIDs (strings). Never send numbers for entity IDs.

## UI and UX

- **Admin vs Operator:** Separate routes/views for admin (org/branch/catalog/staff/ledger/reports) and operator (POS: sale, tenders, shift, day close). Operator UI must work for touch and quick key entry.
- **Multi-tenant:** Every screen that shows data must be scoped to current org (and branch/terminal where applicable). Show org/branch name in header or context switcher.
- **Loading and errors:** Show loading states for async calls; show error messages from backend `message` (and `requestId` for support). No generic “Something went wrong” without at least logging requestId.
- **Forms:** Validate required fields and formats (e.g. email, UUID) before submit. Display backend validation errors in `details` on the relevant fields.
- **Currency and locale:** Use KES and Kenya locale (e.g. en-KE) for amounts and dates unless otherwise configured.

## Code and structure

- **No star imports.** Use named imports.
- **Components:** Prefer function components and hooks. Keep components focused; split large components (e.g. POS sale screen) into smaller presentational and container pieces.
- **API layer:** Centralize API calls (e.g. `api/client` or `services/api`) with base URL, auth header, and `X-Request-Id` injection. Map response status to errors using backend error shape.
- **Types:** Define TypeScript interfaces/types for API request/response bodies; align with backend DTOs (see docs/E2E_FULL_API_REFERENCE.md in backend repo). Use shared types for pagination and ApiError.
- **Routing:** Use React Router; protect admin and operator routes by auth and role/context (e.g. require orgId in state for operator).
- **Tailwind:** Use utility classes; avoid inline styles for layout/colors. Prefer design tokens (e.g. theme colors) in tailwind.config. Keep responsive breakpoints consistent.
- **Redux:** Use for auth, org/branch/terminal context, and optionally cart/current sale. Keep reducers and actions clear; avoid putting ephemeral UI state in Redux when local state is enough.
- **Testing:** Prefer unit tests for utils and hooks; integration tests for critical flows (login → context → one API call). Mock API with backend error shapes (401, 409, validation).

## Security and auth

- **Token:** Obtain access token from Keycloak (e.g. redirect or PKCE). Do not store token in localStorage if same-origin is not guaranteed; prefer memory or httpOnly cookie if backend supports it.
- **Logout:** Clear token and redirect to Keycloak logout or login.
- **iamUserId:** When creating staff user, `iamUserId` in request body must equal JWT `sub`; backend returns 400 otherwise. Use token `sub` from auth state.

## References (backend repo)

- **API reference:** `docs/E2E_FULL_API_REFERENCE.md` – all endpoints, methods, paths, and sample bodies.
- **E2E flow:** `docs/E2E_POSTMAN_GUIDE.md` – order of calls (org → business → branch → terminal → device → staff → catalog → shift → sale).
- **Backend rules:** Backend is org-scoped, Flyway-only DB, no Hibernate DDL; errors include code, message, requestId.

## Checklist before PR

- [ ] All API calls send `Authorization: Bearer <token>` and `Content-Type: application/json` where needed.
- [ ] Org (and branch/terminal) context is set before calling scoped endpoints.
- [ ] Error responses are parsed and user sees `message` (and requestId where useful).
- [ ] No hardcoded API base URL; use env.
- [ ] Pagination uses `page`/`size` and handles `content`/`totalElements`.
- [ ] IDs are strings (UUIDs).
```

---

Use this as the single source of truth for the frontend project’s Cursor rules. Adjust `globs` or add file-specific rules in the same `.cursor/rules/` directory if needed.
