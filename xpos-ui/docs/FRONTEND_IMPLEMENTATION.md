# XPOS Frontend – Implementation Guide

Production-level React frontend for XPOS. Backend API is in the sibling **xpos** repo: `docs/E2E_FULL_API_REFERENCE.md`, `docs/E2E_POSTMAN_GUIDE.md`.

**Implementation phases:** See **`docs/UI_IMPLEMENTATION_PHASES.md`** for the phased plan (Phase 1: Auth + shell, Phase 2: Operator POS, Phase 3: Admin, Phase 4: Shifts/cash, Phase 5: Polish). Each phase lists concrete items and status (done vs pending).

## 1. Stack

- **Vite** – build; env via `import.meta.env.VITE_*`
- **React 18+**, **TypeScript**, **Tailwind CSS**, **Lucide React**, **Redux Toolkit**, **React Router**
- **API:** `src/api/client.ts` (apiFetch + token, X-Request-Id)

## 2. Environment

See `.env.example`. Required: `VITE_API_BASE_URL`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`. Copy to `.env`.

## 3. API client and types

- **Client:** `src/api/client.ts` – `apiFetch(path, { token, body })`. Injects base URL, Authorization, X-Request-Id; parses errors as ApiError.
- **Types:** `src/types/api.ts` – ApiError, ApiErrorDetail, PageResponse<T>, PageParams.
- 401 → clear token, redirect to login. 403 → "You don't have permission". 404/409 → show message + requestId. 400 → map details to form fields.

## 4. Auth and context

1. **Login:** POST to Keycloak token endpoint (`/realms/{realm}/protocol/openid-connect/token`) with `grant_type=password`, `client_id`, `username`, `password` (x-www-form-urlencoded). No client_secret for public/frontend client. Store returned `access_token` and decode JWT `sub` as iamUserId in Redux `auth`.
2. Use token in apiFetch for all backend requests.
3. JWT `sub` = iamUserId when creating staff.
4. Set org (and branch/terminal for operator) in Redux `orgContext` (e.g. from `/api/v1/me` or picker).
5. **Logout:** Clear token and org context; redirect to `/login`.
6. **401:** Clear token and redirect to login (centralized in API layer or guard).

## 5. App structure

- `src/api/` – client
- `src/store/` – auth, orgContext slices
- `src/features/admin|operator|auth|home/`
- `src/components/`, `src/hooks/`, `src/types/`, `src/utils/`
- Routes: `/`, `/login`, `/admin/*`, `/operator/*` (guard with token and context)

## 6. API → screens (see xpos E2E_FULL_API_REFERENCE.md)

Health, Me, Admin (Orgs, Business, Branch, Terminal, Device, Staff), **Units (UOM)**, Catalog (Categories, Items), **Price lists + price list items** (edit list → add/remove item prices), Operator (shift open/close, sales, tenders, **cash movements**, **day close**), **Shifts list**, **Z-Report**, Inventory, Ledger, Audit. Implement in packets: auth + org → org CRUD → branch/terminal → **Units (UOM)** → catalog → items → price lists → operator POS → shifts/Z-report.

## 7. Redux

auth: token, iamUserId. orgContext: orgId, orgName, branchId, terminalId, etc. Optional operator slice: shiftId, saleId, cart.

## 8. Details

- IDs = UUID strings. Items have imageUrl/primaryImageUrl. Currency: KES, formatCurrency (en-KE). CORS: backend allows dev origin; Vite proxy can forward /api.

## 9. Testing (ensure every feature works)

**Goal:** Test every feature so that implementations are verified without depending on a running backend.

- **Unit tests:** Utils and pure logic (e.g. `src/utils/formatCurrency.test.ts`, `src/utils/apiError.test.ts`). No UI.
- **API client tests:** Mock `fetch` and assert that `apiFetch` returns data on 200, throws a structured error on 4xx/5xx, and throws a **user-friendly network error** (e.g. "Cannot reach server…") when `fetch` throws "Failed to fetch". See `src/api/client.test.ts`.
- **Feature/component tests:** For each list or feature page (e.g. Orgs, Branches):
  - **Success path:** Mock the API module (e.g. `vi.mock("@/api/orgs")`), resolve with realistic data, render the page inside Redux + QueryClient providers, assert that the list/UI shows the data (e.g. org names, empty state).
  - **Error path:** Mock the API to reject with `{ status, data: ApiError }` (e.g. network error with `requestId`), render the page, assert that the **user-facing message** and **Reference: requestId** are displayed.
  - Use a small `wrap()` helper that provides a store with a fake token and a QueryClient with `retry: false` so tests are fast and deterministic. See `src/features/admin/OrgsListPage.test.tsx`.
- **Run before commit:** `npm run test` (or `npm run test:watch`). Add at least one integration test per new admin/operator list or flow so the feature is regression-tested.
- **E2E (optional):** Playwright/Cypress against a running backend + Keycloak for critical paths (login → org → one sale).

## 10. Backend docs (xpos repo)

E2E_FULL_API_REFERENCE.md – all endpoints. E2E_POSTMAN_GUIDE.md – flow and example bodies.

---

## 11. UI/UX and code standards (mandatory)

Apply these across all features so the app is consistent, maintainable, and production-grade.

### 11.1 Reusability and layout

- **Highly reusable components:** Build small, single-purpose components in `src/components/` (e.g. `DataTable`, `ConfirmDialog`, `SlideOverForm`, `PageHeader`). Compose screens from these; avoid one-off inline markup.
- **Screens grow with content:** Use scrollable main content (e.g. `overflow-auto` on main area). Do not fix viewport height in a way that clips lists or forms; let the page expand and scroll. Content area should have a minimum height (e.g. viewport minus header) so short content still feels full; grids/cards can use flex/grid to use space. Follow industry best practice: content-driven height with internal scroll where needed.
- **Sidebar anchored, not hanging:** The left vertical sidebar must feel integrated: use `sticky top-0` and fixed height (e.g. `calc(100vh - headerHeight)`) so it stays in view when the user scrolls. Use a soft edge (e.g. subtle box-shadow or gradient) so the sidebar blends into the content area rather than looking like a floating strip.
- **Consistency:** Use the same patterns for lists (table or card grid), forms (slide-over from right), and actions (primary/secondary/danger buttons). Reuse spacing, typography, and border radius from Tailwind config.

### 11.2 Forms and editing

- **Slide-over from right:** All create/edit forms for capturing or editing data must open as a **slide-over panel from the right** (not a full-page form or a small modal). Use a shared `SlideOver` or `Drawer` component with a consistent width (e.g. `max-w-md` or `max-w-lg`). Close on success or cancel.
- **Shared form components:** Use shared inputs, selects, and validation feedback so every form looks and behaves the same.

### 11.3 Destructive and critical actions

- **Confirm dialog before delete (and similar):** Any destructive or critical action (delete, deactivate, void, etc.) must show a **confirmation dialog** before proceeding. Use a shared `ConfirmDialog` component with title, message, and Confirm/Cancel. Do not delete or perform the action without explicit user confirmation.

### 11.3b Action feedback (toasts)

- **Toast notifications:** After any mutation (create, update, delete, deactivate, bind, etc.), show a **toast** in the **top-right corner**: success (e.g. “Organization created.”) or error (user-facing message + optional “Reference: requestId”). Use the shared `ToastProvider` and `useToast()`: `toast.success(message, { title?, detail? })` and `toast.error(message, { title?, detail? })`. Toasts auto-dismiss (e.g. 5s success, 7s error), can be dismissed manually, and use enter/exit animations (slide in from right, fade out). Industry standard: clear title, message, optional detail line; success = green/check icon, error = red/alert icon; `role="status"` / `aria-live="polite"` for success, `role="alert"` / `aria-live="assertive"` for errors.

### 11.4 Shareable components

- **Easier reuse:** Export components from a single place (e.g. `src/components/ui/` or `src/components/`). Prefer props over context for configuration. Document required and optional props. Avoid deep prop drilling; use composition or a minimal context when needed.
- **Code readability:** Prefer clear names, small functions, and explicit types. Extract magic strings/numbers to constants. Keep components under ~100 lines; split into subcomponents or hooks when larger.

### 11.5 State management

- **Top-notch state:** Use Redux for global app state (auth, orgContext, cart). Use TanStack Query (or RTK Query) for server state (lists, details) with clear cache keys and invalidation. Keep UI-only state (e.g. open/closed slide-over) in local state or a small context. Avoid duplicate sources of truth; derive values when possible.

### 11.6 Pagination

- **Top-notch pagination:** All list endpoints must use **pagination**. Use a shared `Pagination` component (page size selector, prev/next, page numbers or “Page X of Y”). Respect backend `page`, `size`, `sort`; display `totalElements` and enforce a max page size (e.g. via `PageRequestFactory` on backend). Do not load unbounded lists.

### 11.7 Idle logout

- **Automatic logout after idle:** The system must **automatically log out** the user after a period of inactivity (e.g. **5 minutes**). Implement an idle timer (e.g. track last activity on mouse/keyboard/touch, or on API calls). When the threshold is reached: clear token and org context, redirect to `/login`, and optionally show a short message (“You were logged out due to inactivity”). Make the idle duration configurable (e.g. env or constant).

### 11.8 Left vertical sidebar

- **Collapsible sidebar:** The **left vertical navigation** (Admin and Operator sidebars) must be **collapsible**. Provide a toggle (e.g. chevron or hamburger) to collapse to icon-only or a slim strip, and expand to full width. Persist the user’s preference (e.g. `localStorage` key `xpos_sidebar_collapsed`) so it survives reload.

### 11.9 Dark and light themes

- **Support both themes:** The UI must support **dark and light themes**. Use Tailwind’s `dark:` variant and a theme provider (e.g. class `dark` on `html` or a wrapper). Provide a theme toggle (e.g. in header or settings) and persist the choice (e.g. `localStorage`). Ensure all screens and shared components look correct in both themes (contrast, borders, backgrounds).
- **Default light theme – light bluish with blending:** The default (light) theme should use a **light bluish** palette with nice blending: CSS variables in `index.css` for app background gradient (`--app-bg-start`, `--app-bg-end`, `--app-bg-mid`), sidebar gradient (`--sidebar-start`, `--sidebar-end`, `--sidebar-edge`), and optional card tokens. Use `bg-app` and `bg-sidebar` utilities. Cards and surfaces: soft borders (e.g. `border-sky-200/70`), `bg-white/90` or `surface` colors, so the UI feels cohesive and visually strong.

STOCK TAKING REQUIREMENTS
- Implement stock_count_session + stock_count_line with two-phase workflow: count -> submit -> approve -> post.
- Support MANUAL, AUTOMATIC (suggestions), and HYBRID counting modes.
- Freeze snapshot: capture system_qty_at_freeze at freeze time and compute variance against it.
- Posting creates stock_movement adjustments (movement_type=STOCK_COUNT_ADJUSTMENT) in a single transaction.
- Prevent double posting (idempotent post).
- Enforce org/branch scoping and staff authorization.
- Error messages must be user-facing and specific; map DB constraints.
- Provide APIs for session lifecycle and line upsert; optional import endpoint.
- UI must support barcode scanning, fast entry, and supervisor review with variance thresholds.s
