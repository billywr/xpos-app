# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XPOS UI is a React frontend for a multi-vertical POS system used in Kenya (supermarkets, retail shops, pubs, bars, restaurants, hotels). The backend is a Spring Boot monolith with Keycloak for IAM. The system is org-scoped, then branch/terminal/device/staff-scoped.

## Commands

```bash
npm run dev          # Vite dev server (port 5173) — always verify after changes
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm run test         # Vitest single run
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright (all tests, requires built app via npm run preview)
npm run test:e2e:smoke  # Playwright smoke test only
```

Run a single test file: `npx vitest run src/features/admin/OrgsListPage.test.tsx`

After meaningful UI changes, confirm `npm run dev` starts cleanly (no compile/transform errors).

## Environment Variables

Set in `.env` (see `.env.example`):
- `VITE_API_BASE_URL` — backend URL (e.g. `http://localhost:9003`)
- `VITE_KEYCLOAK_URL` — Keycloak server
- `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` — Keycloak config
- `VITE_IDLE_LOGOUT_MINUTES` — auto-logout delay (default: 5)
- `VITE_USE_KEYCLOAK_PROXY` — use same-origin proxy in prod

## Architecture

### API Layer (`src/api/`)

All HTTP calls go through `apiFetch<T>()` in `src/api/client.ts`. It:
- Attaches Bearer token from Redux auth slice
- Generates and attaches `X-Request-Id` header on every request
- Normalizes errors to `ApiError` type (`src/types/api.ts`)
- Calls a 401 handler (set in `App.tsx`) to clear auth and redirect to `/login`

Endpoint modules (40+) export typed async functions that call `apiFetch`. Pattern: `fetchOrgs(token, params)`, `createOrg(token, body)`, etc.

### State Management

Three layers:
1. **Redux** (`src/store/slices/`) — auth token (`authSlice`), org/branch/terminal context (`orgContextSlice`), POS cart (`cartSlice`). Auth and context persisted to `sessionStorage`.
2. **TanStack React Query** — server state (lists, analytics). Common settings: staleTime 60s, retry 1. Mutations invalidate queries on success.
3. **React Context** — theme (`ThemeContext`), toast notifications (`ToastContext`), nav visibility (`NavVisibilityContext`).

Typed hooks: `useAppDispatch()`, `useAppSelector()` in `src/hooks/`.

### Routing (`src/App.tsx`)

```
/login              — public
/select-context     — protected, pick org/branch/terminal
/admin/*            — AdminLayout, requires auth
/operator/*         — OperatorLayout, requires auth + org+branch+terminal context
```

Guards: `<ProtectedRoute>` (token check), `<OperatorContextGuard>` (full context check), `<RestoreContext>` (restores from sessionStorage on load).

### Auth Flow

Keycloak password grant → JWT stored in Redux + sessionStorage → `apiFetch` attaches as Bearer token → 401 clears auth and redirects. Idle auto-logout via `useIdleLogout()` hook (default 5 min).

### Feature Modules (`src/features/`)

Six modules: `auth`, `context`, `home`, `admin` (30+ pages), `operator` (15+ pages), `stockCount`. Each contains page components using React Query for data fetching and local state for UI.

### Shared Components (`src/components/`)

- **Layouts**: `Layout.tsx` (header), `AdminLayout.tsx`, `OperatorLayout.tsx` (sidebar + outlet)
- **UI** (`components/ui/`): `SlideOver` (right-sliding panel for all create/edit forms), `ConfirmDialog`, `Pagination`, `Toast`, `AdminTabList`/`AdminTabPanel`
- **SearchableSelect** — preferred over native `<select>` for dropdowns. Supports keyboard nav (arrows, Enter, Escape) and aria attributes.
- **ItemSearchCombobox** — catalog item search by name/SKU/barcode

## Key Conventions

- **Icons**: lucide-react only
- **Currency**: KES formatting via `formatCurrency.ts` (Intl.NumberFormat, en-KE)
- **Forms**: react-hook-form + Zod validation. SlideOver for create/edit. Field-level errors from backend `details` shown inline.
- **Dropdowns**: `SearchableSelect` instead of native `<select>`. `ItemSearchCombobox` for catalog items.
- **Error handling**: 400 → inline field errors; 401 → redirect to login; 403 → permission screen; 409 → show backend message verbatim; 5xx → message + requestId + "contact support". Use `getApiErrorMessage()` and `getApiErrorRequestId()` from `src/utils/apiError.ts`.
- **Toasts**: success/error via `ToastContext`. Non-field errors include requestId.
- **Dark mode**: class-based (`darkMode: "class"`). Custom colors: `darkNav`, `darkSurface`, `darkBg`, `primary` (sky blue), `surface` (light blue) in `tailwind.config.js`.
- **IDs**: all UUIDs are strings, suffixed with `Id` (e.g. `orgId`, `branchId`)
- **No star imports**. Keep imports explicit.
- **No dead code, no console logs, no leftover TODOs**.

## Docs

Additional context in `docs/`:
- `FRONTEND_IMPLEMENTATION.md` — UI implementation guide (section 11 covers reusable component patterns)
- `E2E_FULL_API_REFERENCE.md` — backend API reference
- `UI_IMPLEMENTATION_PHASES.md` — feature rollout phases
