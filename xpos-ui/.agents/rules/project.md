---
description: XPOS React frontend — product rules, API contract, UX, operator/admin features (Kenya POS)
alwaysApply: true
---

# XPOS Frontend (Production)

> Architecture, routing, state, and conventions: see `architecture.md`.

You are building the XPOS frontend UI for a control-first POS system used in Kenya (supermarkets, retail shops, pubs & bars, restaurants, hotels).
This UI must support fast cashier flows, strict accountability, and must show specific backend errors (no vague error messages).
The backend is a Spring Boot monolith using Flyway migrations and Keycloak for IAM. XPOS is org-scoped and later branch/terminal/device/staff-scoped.

## Tech Stack & Rules
- React 18+, Vite, TypeScript (strict), Tailwind CSS.
- Icons: lucide-react only.
- State: Redux Toolkit (RTK) + RTK Query optional (if used, keep it consistent across app).
- Router: React Router.
- No star imports. Keep imports explicit.
- Prefer small, focused components and hooks.
- All UUIDs are strings in the UI.
- Always handle network errors, timeouts, and non-2xx responses.
- Follow a consistent, professional UI style suitable for retail/hospitality.
- should support both dark and light themes
- **Dropdowns:** Prefer `SearchableSelect` (`src/components/SearchableSelect.tsx`, also exported from `src/components/ui/index.ts`) instead of native `<select>` for searchable auto-suggest. Use `ItemSearchCombobox` for catalog items (name, SKU, barcode). Keep keyboard support (↑/↓, Enter, Escape) and `aria-label` / `id` for accessibility.

## Runtime Config
- `VITE_API_BASE_URL` points to the backend base URL.
- `VITE_IDLE_LOGOUT_MINUTES` (optional): idle auto-logout delay in minutes; default 5 if unset or invalid. See `src/config/idleLogout.ts`.
- All API calls must use `src/api/client.ts` wrapper.
- The client must:
  - Attach Bearer token (Keycloak access token).
  - Attach `X-Request-Id` on every request (generate uuid per request).
  - Read `X-Request-Id` from response headers and store it in error state if present.
  - Normalize errors into a single typed `ApiError` shape.

## API Client Contract (src/api/client.ts)
### Required behavior
- `apiFetch<T>(path, options) -> Promise<T>`:
  - On success: return parsed JSON.
  - On non-2xx: parse backend error envelope and throw `ApiError`.
  - Always prefer backend-provided `message` for user display.
  - Include `requestId` in thrown errors (from body or header).
  - Provide a safe fallback when the response isn’t JSON.

### Error handling rules
- 400 validation: show field-level messages next to inputs (do NOT show only a toast).
- 401 unauthenticated: clear auth state and redirect to login.
- 403 forbidden: show “You don’t have permission” screen (no retry loop).
- 404 not found: show a “not found” or contextual error.
- 409 conflict: show backend message as-is (common for duplicates / constraints).
- 5xx: show message + requestId + “Contact support with this requestId”.

## Types (src/types/api.ts)
Maintain strong types for:
- `ApiError`:
  - `code: string`
  - `message: string`
  - `requestId?: string`
  - `details?: Array<{ key: string; value: string }>`
  - `httpStatus?: number`
- `PageResponse<T>`:
  - `content: T[]`
  - `page: { number: number; size: number; totalElements: number; totalPages: number }`
  - If backend uses Spring Page, map accordingly.
- Common models:
  - Org, Business, Branch, Terminal, DeviceRegistration
  - StaffUser, StaffProfile, StaffBranchAssignment

## Auth & Identity (Keycloak)
- Keycloak is the source of truth for authentication.
- Use Keycloak access token from login, stored in memory + secure storage strategy:
  - Prefer in-memory + refresh on reload (or session storage depending on your approach).
  - Never log tokens.
- Extract only what is safe from token (e.g., `sub`, `preferred_username`, roles if present).
- UI must always include org context (orgId) in requests.

## Global UX Requirements (Kenya POS)
- **Reusable components:** Screens grow with content; forms slide in from right; confirm dialog before delete/destructive actions; top-notch state + pagination; idle logout (~5 min); collapsible left sidebar; dark/light theme support.
- Speed matters: cashier UI must be optimized for keyboard/touch.
- Offline-first is future, but UI must be resilient now:
  - Show clear “Network offline” state.
  - Do not lose in-progress forms; keep draft state where appropriate.
- Use KES currency formatting everywhere:
  - Display: `KES 1,234.00` (or `KSh` consistent).
- Taxes: show inclusive/exclusive breakdown clearly (Kenya VAT scenarios like 16%).
- Always show branch + terminal + user identity in header once selected (accountability).
- Use consistent empty/loading/error states.

## Development Workflow
- New UI work must include:
  - Types
  - API endpoint wrapper
  - Slice changes (if needed)
  - Screen + component
  - Basic tests (at least one per feature: rendering + error state)
- Keep code production-grade: no dead code, no console logs, no TODOs left behind.
- For every screen that has an Add button, ensure edit and soft delete capabilities.

## Verification
- After meaningful `xpos-ui` changes, **always confirm with `npm run dev`**: the Vite dev server must start cleanly (no compile/transform errors in the terminal).
