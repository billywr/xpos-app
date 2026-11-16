# XPOS Frontend – Implementation Guide

This document describes how to build a **production-level React frontend** for XPOS: app structure, auth, API integration, state, and best practices. Use it together with **E2E_FULL_API_REFERENCE.md** and **E2E_POSTMAN_GUIDE.md**.

---

## 1. Stack and tooling

| Layer        | Choice              | Notes |
|-------------|---------------------|--------|
| Framework   | React 18+           | Function components, hooks |
| Language    | TypeScript          | Recommended for API types and safety |
| Styling     | Tailwind CSS        | Utility-first; theme in `tailwind.config` |
| State       | Redux (RTK)         | Auth, org/branch/terminal, cart/sale |
| API + cache | RTK Query or TanStack Query | Recommended for caching and loading states |
| Routing     | React Router v6     | Protected routes for admin/operator |
| Auth        | Keycloak JS adapter or react-oidc-context | Token for `Authorization: Bearer` |
| Build       | Vite or CRA         | Env vars: `VITE_*` or `REACT_APP_*` |

---

## 2. Environment variables

```bash
# Required
VITE_API_BASE_URL=http://localhost:9003
VITE_KEYCLOAK_URL=https://your-keycloak/auth
VITE_KEYCLOAK_REALM=xpos
VITE_KEYCLOAK_CLIENT_ID=xpos-frontend

# Optional (if different in prod)
# VITE_KEYCLOAK_REDIRECT_URI=
# VITE_APP_NAME=XPOS
```

- **API base URL:** No trailing slash. All requests: `VITE_API_BASE_URL + '/api/v1/...'`.
- **Keycloak:** Same realm/client as backend; token `sub` is `iamUserId` when creating staff.

---

## 3. API client contract

### Base configuration

- **Base URL:** `import.meta.env.VITE_API_BASE_URL` (Vite) or `process.env.REACT_APP_API_BASE_URL`.
- **Headers (every request):**
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json` (for POST/PUT/PATCH with body)
  - `X-Request-Id: <uuid>` (e.g. `crypto.randomUUID()`)

### Error response shape (align with backend)

```ts
interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

interface ApiError {
  timestamp: string;   // ISO
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  requestId: string;
  details?: ApiErrorDetail[];
}
```

- **401:** Clear token, redirect to login (or refresh).
- **403:** Show “You don’t have permission”; do not expose internals.
- **404:** “Resource not found” + optional requestId.
- **409:** Show `message` (e.g. duplicate name).
- **400:** Map `details` to form fields.

### Pagination

- **Request:** `?page=0&size=20&sort=name,asc` (and other sort params as per API).
- **Response:** `{ content: T[], totalElements, totalPages, size, number, first, last }`.

---

## 4. Auth and user context

1. **Login:** Keycloak redirect → user logs in → redirect back with code → exchange for tokens.
2. **Storage:** Prefer in-memory or short-lived sessionStorage for access token; avoid localStorage for tokens if XSS is a concern.
3. **Token usage:** Attach to every API request: `Authorization: Bearer ${accessToken}`.
4. **User identity:** Parse JWT `sub` as `iamUserId`; use for “Me” and when creating staff.
5. **Org context:** After login, call `GET /api/v1/me?orgId=...` (or org list) and let user pick org; store `orgId` in Redux. Operator: also set `branchId`, `terminalId` (from assignment or selection).
6. **Logout:** Clear token and Redux state; redirect to Keycloak logout.

---

## 5. App structure and routes

Suggested high-level structure:

```
src/
  api/           # Base client, interceptors, RTK Query base or axios instance
  store/         # Redux slices (auth, org, operator context, cart/sale)
  features/      # Feature-based modules
    admin/       # Org, business, branch, terminal, device, staff, catalog, ledger
    operator/    # POS: shift, sale, tenders, receipt
    auth/        # Login callback, logout, token refresh
  components/    # Shared UI (buttons, inputs, modals, tables, error banner)
  hooks/         # useAuth, useOrg, useApiError
  types/         # API DTOs, ApiError, pagination
  routes/        # Route config and protected route wrapper
  utils/         # formatCurrency, formatDate, requestId
  App.tsx
  main.tsx
```

### Route layout (example)

- **Public:** `/login`, `/login/callback`
- **Admin:** `/admin/orgs`, `/admin/orgs/:orgId/...` (businesses, branches, catalog, staff, ledger, etc.)
- **Operator:** `/operator` (POS), `/operator/shift`, `/operator/sales`
- **Guards:** Require token; for `/admin/*` require admin role/context; for `/operator/*` require `orgId` + `branchId` + `terminalId` (and open shift if needed).

---

## 6. Mapping API to screens (from E2E_FULL_API_REFERENCE.md)

| Area        | Endpoints (summary) | UI / feature |
|------------|----------------------|--------------|
| Health     | GET /api/v1/health   | Status or dev banner |
| Me         | GET /api/v1/me       | User info, org list, roles |
| Admin – Orgs | CRUD /api/v1/admin/orgs | Org list, create, edit |
| Admin – Business | CRUD under org | Business list, create, edit |
| Admin – Branch | CRUD under org | Branch list, create, edit |
| Admin – Terminal | CRUD under branch | Terminal list, create, edit |
| Admin – Device | CRUD under org (register per branch) | Device list, register, activate/deactivate |
| Admin – Staff | CRUD under org | Staff list, register self, profile, branch assignments, activate/deactivate |
| Catalog    | Categories, **UoMs**, tax profiles, items (imageUrl, baseUomId, barcodes, modifier groups) | Catalog (categories), **Units (UOM)** list CRUD, Items list CRUD with UoM dropdown |
| Pricing    | Price lists, **price list items** (item + price + currency per list) | Price lists list; **Edit price list** → add/remove menu item prices (used by Operator Menu Order) |
| Operator   | Shift open/close, sales, tenders, receipt; **cash movements**, **day close** | POS Menu Order (categories, items, cart, confirm payment); Dashboard: open/close shift, paid in/out, day close |
| Cash (admin) | List shifts, get Z-report | **Shifts** (org + branch, paginated); **Z-Report** (org + branch + business date) |
| Inventory  | Stock, movements     | Stock levels, adjustments (admin UI as needed) |
| Ledger     | Postings, accounts   | Ledger view, reports |
| Compliance / Fraud / Audit | As in API | Compliance and audit UIs |

**Operator staff resolution:** Operator endpoints (open shift, cash movements, day close) resolve the current staff user via `requireStaffUserForBranch(orgId, branchId, iamUserId)`: first by org + JWT sub, then by branch assignment so staff assigned to the selected branch can operate even if lookup by org would fail.

Implement in **packets**: e.g. auth + org context → org CRUD → branch/terminal → **Units (UOM)** → catalog → items → price lists (and price list items) → operator POS → shifts/cash/Z-report.

---

## 7. Redux (and RTK) usage

- **Auth slice:** `{ token, iamUserId, expiresAt }` (or minimal claims). Clear on logout.
- **Org context slice:** `{ orgId, orgName?, branchId?, branchName?, terminalId?, terminalName? }`. Set after login/selection; operator flows require branch + terminal.
- **Operator slice (optional):** `{ shiftId?, saleId?, cart }` for current sale and tenders.
- **RTK Query:** Define base query with `baseUrl`, `prepareHeaders` (Authorization, X-Request-Id), and transform error response into `ApiError` so components can show `message` and `requestId`.

---

## 8. Important implementation details

- **IDs:** All entity IDs are **UUID strings**. Never send numbers.
- **Image URL:** Items support `imageUrl` / `primaryImageUrl`; use in catalog and POS (thumbnail).
- **Currency:** KES; format with locale `en-KE`.
- **CORS:** Backend allows configured origins; set `VITE_API_BASE_URL` to same origin or ensure backend allows your dev origin (e.g. `http://localhost:5173`).

---

## 9. Error handling (code)

- Centralize: one `api` client or RTK Query `baseQuery` that:
  - Adds `Authorization`, `Content-Type`, `X-Request-Id`.
  - On non-2xx, parses JSON as `ApiError` and rejects with `{ status, data: ApiError }`.
- In components: read `error.data.message` and `error.data.requestId`; show in toast or inline error component. Map `details` to form fields for 400.

---

## 10. Testing and quality

- **Unit:** Utils (formatCurrency, requestId), hooks (useOrg, useApiError).
- **Integration:** Login → set org → load list (e.g. branches); mock API with 200 and 401/409/400 responses using backend error shape.
- **E2E (optional):** Playwright/Cypress against dev backend + Keycloak; follow E2E_POSTMAN_GUIDE flow.

---

## 11. Cursor rules for frontend

Copy the content from **FRONTEND_CURSOR_RULES.md** into your frontend repo’s **`.cursor/rules/project.mdc`** so that AI and developers follow the same API contract, auth, error handling, and structure.

---

## 12. Quick reference – backend docs (this repo)

| Doc | Purpose |
|-----|--------|
| **E2E_FULL_API_REFERENCE.md** | All endpoints, methods, request/response samples |
| **E2E_POSTMAN_GUIDE.md** | Step-by-step flow (org → … → sale) and example bodies |
| **FRONTEND_CURSOR_RULES.md** | Text to put in frontend `.cursor/rules/project.mdc` |
| **FRONTEND_IMPLEMENTATION.md** | This file – structure, auth, API, Redux, checklist |
| **IMPLEMENTATION_PLAN.md** | Backend phased plan (Phases 1–9; catalog, pricing, cash, sales, etc.) |

**Frontend repo:** The React UI has its own phased plan in **docs/UI_IMPLEMENTATION_PHASES.md** (Phase 1: Auth, Phase 2: Operator POS, Phase 3: Admin, Phase 4: Shifts/cash/Z-report, Phase 5: Polish). Admin screens include Units (UOM), Price lists (with price list items in Edit), Shifts, Z-Report.
