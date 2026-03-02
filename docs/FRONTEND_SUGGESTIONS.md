# XPOS Frontend – Suggestions and best practices

Recommendations for making the React UI production-ready and maintainable.

---

## 1. API and data fetching

- **RTK Query or TanStack Query:** Add later for list/catalog endpoints to get caching, loading/error state, and deduplication. Keep using the same base URL and auth (inject token in `prepareHeaders` or equivalent).
- **Shared types:** Keep extending `src/types/` with DTOs that mirror backend request/response bodies (see xpos `E2E_FULL_API_REFERENCE.md`). Use a single `ApiError` type for all error handling.
- **Request ID:** Always send `X-Request-Id` (already in `apiFetch`). In error UI, show “Reference: {requestId}” so support can trace issues.

---

## 2. State and context

- **Org/branch/terminal selectors:** Export selectors from the orgContext slice (e.g. `selectOrgId`, `selectBranchId`) and use them in components and API calls so the correct context is always used.
- **Persist org choice:** Optionally persist last selected orgId (e.g. sessionStorage) and restore on reload so the user doesn’t have to reselect every time.

---

## 3. UX and accessibility

- **Loading states:** Use skeletons or spinners for lists and forms; disable submit buttons while submitting.
- **Error banner:** A global or layout-level error banner that shows `message` and `requestId` from API errors keeps handling consistent.
- **Touch and operator UI:** For the POS (operator), use large tap targets, clear labels, and keyboard shortcuts where possible. Test on touch devices.
- **a11y:** Semantic HTML, ARIA where needed, focus management in modals. Ensure form errors are announced (e.g. aria-describedby for field errors).

---

## 4. Security

- **Token storage:** Prefer in-memory or sessionStorage for the access token. If you must use localStorage, ensure the app is only served over HTTPS and consider XSS mitigations.
- **Logout everywhere:** On 401, clear token and redirect to login so the user can re-authenticate.

---

## 5. Testing

- **Unit:** Utils and pure hooks (e.g. formatCurrency, requestId, useApiError).
- **Integration:** One flow: “user has token and orgId → load branches list → show list or error.” Mock `apiFetch` or the backend with 200 and 401/409/400 responses using the real `ApiError` shape.
- **E2E:** One critical path aligned with xpos `E2E_POSTMAN_GUIDE.md` (login → org → branch → open shift → one sale) to catch regressions.

---

## 6. Performance and DX

- **Code splitting:** Lazy-load admin and operator route chunks so the initial bundle stays small (e.g. `React.lazy` for `/admin` and `/operator`).
- **Path alias:** `@/` is already set in `vite.config.ts` and `tsconfig`; use it for imports (e.g. `import { apiFetch } from "@/api/client"`).
- **Env validation:** Optionally validate `VITE_*` at startup and show a clear error if `VITE_API_BASE_URL` is missing.

---

## 7. Optional dependencies to consider

- **RTK Query** – Caching and loading states for REST endpoints.
- **TanStack Query** – Alternative to RTK Query if you prefer a non-Redux cache.
- **Keycloak JS adapter** or **react-oidc-context** – Simplify Keycloak login and token refresh.
- **Zod or Yup** – Form validation and alignment with backend validation messages.
- **React Hook Form** – Forms with less re-renders and easy integration with validation and backend `details` errors.
- **Playwright or Cypress** – E2E tests against the real backend and Keycloak.

---

## 8. Checklist before going to production

- [ ] All API calls use the central client and send token + X-Request-Id.
- [ ] Org (and branch/terminal) context is required and used for every scoped request.
- [ ] Error messages shown to users come from backend `message` (and requestId for support).
- [ ] No hardcoded API URL or secrets; use env only.
- [ ] Keycloak and backend CORS are configured for the production frontend origin.
- [ ] Build passes (`npm run build`) and preview is tested.
