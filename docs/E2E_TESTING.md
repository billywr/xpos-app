# E2E Testing (Playwright)

E2E tests cover critical user flows. Run with Playwright against the built app.

## Prerequisites

- `npm run build` (or let webServer run it)
- For smoke tests: no backend/Keycloak needed
- For sale-flow: backend + Keycloak running, `E2E_TEST_USER` and `E2E_TEST_PASSWORD` set

## Commands

```bash
# Run all E2E tests (starts preview server automatically)
npm run test:e2e

# Smoke tests only (login page, redirect)
npm run test:e2e:smoke

# Interactive UI mode
npm run test:e2e:ui
```

## Manual server start

If webServer fails to start (e.g. in some CI), run the app first:

```bash
npm run build && npm run preview
```

Then in another terminal:

```bash
npx playwright test e2e/smoke.spec.ts
```

## Sale flow test

Requires backend and Keycloak with a test user. Set env vars:

```
E2E_TEST_USER=your_keycloak_username
E2E_TEST_PASSWORD=your_keycloak_password
```

The test is skipped when credentials are not set.
