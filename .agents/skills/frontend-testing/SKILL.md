---
name: xpos-frontend-testing
description: XPOS UI testing — Vitest, Playwright, E2E-first, minimal mocking. Use when writing or reviewing frontend tests in xpos-ui.
---

# XPOS Frontend Testing

Follow frontend testing best practices: prefer E2E, test behavior not implementation, minimize mocking.

## Commands

```bash
npm run test                              # Vitest
npx vitest run src/features/admin/OrgsListPage.test.tsx
npm run test:e2e                          # Playwright (build first)
npm run test:e2e:smoke
```

## XPOS Conventions

- At least one test per feature: rendering + error state.
- Mock `apiFetch` sparingly; prefer integration-style tests with MSW or E2E for critical flows.
- Test backend error display: message, requestId, field-level 400 `details`.
- Operator flows: keyboard/touch paths where relevant.
- After meaningful UI changes: `npm run dev` must start cleanly.

## When to Use What

| Scenario | Approach |
|----------|----------|
| New admin/operator page | Vitest render + error state |
| Cashier/payment/debt flow | Playwright E2E |
| Utility (formatCurrency, apiError) | Unit test |
| Component internals | Avoid — test via page E2E |
