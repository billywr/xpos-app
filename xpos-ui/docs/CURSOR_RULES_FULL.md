# Full Cursor rules (optional copy into .cursor/rules/project.mdc)

**Updated:** Rules are now maintained in `.cursor/rules/` (`project.mdc` + `architecture.mdc` synced from `CLAUDE.md`). See `.cursor/README.md`.

The file `.cursor/rules/project.mdc` contains product/requirements rules. Architecture and conventions from `CLAUDE.md` live in `.cursor/rules/architecture.mdc`.

If you prefer a single file, copy the markdown below into `.cursor/rules/project.mdc`.

---

- **Tech stack:** React, Vite, TypeScript, Tailwind CSS, Lucide React (named imports), Redux Toolkit, React Router. Central API in src/api/client.ts.
- **Backend:** VITE_API_BASE_URL, no trailing slash. API prefix /api/v1. Send Authorization Bearer token, Content-Type application/json for body, X-Request-Id on every request. Org-scoped; include orgId (and branchId/terminalId for operator).
- **Errors:** Backend returns code, message, requestId, details (optional). Types in src/types/api.ts. 401 clear token and redirect to login. 403 show "You don't have permission". 404/409 show message and requestId. 400 map details to form fields. Never show raw stack traces.
- **State:** Auth slice (token, iamUserId). OrgContext slice (orgId, branchId, terminalId, etc.). Pagination: PageResponse with content, totalElements, page, size. All IDs are UUID strings.
- **UI:** Admin vs Operator routes. Multi-tenant; show org/branch in header. Loading states and error message + requestId. Currency KES, en-KE, use formatCurrency.
- **Code:** No star imports. Use apiFetch with token. Types in src/types. Tailwind utilities; theme in tailwind.config.js. When creating staff, iamUserId must equal JWT sub.
- **References:** docs/FRONTEND_IMPLEMENTATION.md, docs/FRONTEND_SUGGESTIONS.md. Backend: xpos repo E2E_FULL_API_REFERENCE.md, E2E_POSTMAN_GUIDE.md.
