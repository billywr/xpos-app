# XPOS Frontend UI Agent Guidelines

You are building the **XPOS frontend UI** for a control-first POS system used in Kenya (supermarkets, retail shops, pubs & bars, restaurants, hotels).
This UI must support fast cashier flows, strict accountability, and must display specific backend errors (no vague error messages).
The backend is a Spring Boot monolith using Flyway migrations and Keycloak for IAM. XPOS is org-scoped and branch/terminal/device/staff-scoped.

---

## Tech Stack & Conventions

- **React 18+**, **Vite**, **TypeScript** (strict mode), **Tailwind CSS**.
- **Icons**: `lucide-react` only.
- **State**: Redux Toolkit (RTK) (`src/store/slices/`) + React Query for server state.
- **Routing**: React Router (`src/App.tsx`).
- **No star imports**. Keep imports explicit.
- **UUIDs**: Represented as strings in the UI with `Id` suffix (`orgId`, `branchId`).
- **Dropdowns**: Prefer `SearchableSelect` (`src/components/SearchableSelect.tsx`) instead of native `<select>` for searchable auto-suggest. Use `ItemSearchCombobox` for catalog items (name, SKU, barcode).
- **Themes**: Support dark and light themes (four dark variants: Ocean, Magenta, Midnight, Slate).

---

## Commands & Verification Workflow

```bash
npm run dev          # Vite dev server (5173) — verify after meaningful changes
npm run build        # TypeScript check + production bundle
npm run lint         # ESLint
npm run test         # Vitest single run
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright E2E
npm run test:e2e:smoke
```

Run single test:
```bash
npx vitest run src/features/admin/OrgsListPage.test.tsx
```

> [!IMPORTANT]
> **Always confirm with `npm run dev` after meaningful UI changes**: The Vite dev server must start cleanly (no compile/transform errors in terminal). In automation, verify until the local server URL appears.

---

## Runtime Config & API Client Contract

Environment variables (`.env.example`):
- `VITE_API_BASE_URL`: Backend URL (e.g. `http://localhost:9003`)
- `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`
- `VITE_IDLE_LOGOUT_MINUTES`: Auto-logout timeout (default: 5 minutes)

### API Client (`src/api/client.ts`)
- All HTTP calls must go through `apiFetch<T>(path, options)`.
- Automatically attaches Keycloak Bearer access token.
- Generates and attaches `X-Request-Id` (UUID) per request.
- Reads `X-Request-Id` from response headers and preserves it on error.
- Throws normalized `ApiError` (`code`, `message`, `requestId`, `details`, `httpStatus`).

### Error Handling Rules
- **400 Validation**: Show field-level messages next to inputs (do NOT show only a toast).
- **401 Unauthenticated**: Clear auth state and redirect to `/login`.
- **403 Forbidden**: Display "You don't have permission" screen (no retry loop).
- **404 Not Found**: Display contextual "not found" state.
- **409 Conflict**: Display backend `message` verbatim (common for duplicate codes/devices).
- **5xx Server Error**: Show `message` + `requestId` + "Contact support with this requestId".

---

## Global UX & Layout Requirements (Kenya POS)

- **Speed**: Cashier UI must be optimized for keyboard/touch interactions (min 44px touch targets).
- **Currency**: Tables use `(KSH)` in column header and `formatAmount()` in cells (left-aligned). One-off amounts use `formatCurrency()`.
- **Forms**: Use `react-hook-form` + `zod`. Forms slide in from right (`SlideOver`). Confirm dialogs before deletes or destructive actions.
- **CRUD Expectation**: For every screen that has an "Add" button, provide edit and soft-delete capabilities.
- **Responsiveness**: Always use Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`). Never use fixed pixel widths that break mobile.

---

## Dark Themes

Four variants selectable in Admin Settings: Ocean (default), Magenta, Midnight, Slate.
- Applied via `<html data-theme="...">`; `src/index.css` remaps `dark:bg-slate-*`, `dark:border-slate-*`, `dark:bg-primary-*` to CSS variables.
- Cards/tables/modals: `dark:bg-slate-800`
- Inputs, table headers, secondary buttons: `dark:bg-slate-700`
- Page chrome: `dark:bg-slate-900`
- Borders: `dark:border-slate-700`
- Accents: `bg-primary-500`/`-600`
- **Do not** use legacy `dark:bg-darkBg`, `dark:bg-darkSurface`, `dark:bg-darkNav` on new code.
