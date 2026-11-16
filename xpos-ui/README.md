# XPOS UI

Production React frontend for **XPOS** (multi-vertical POS for Kenya). Built with Vite, React, TypeScript, Tailwind CSS, Lucide React, Redux Toolkit, and React Router. Consumes the XPOS REST API; auth via Keycloak.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `VITE_API_BASE_URL` – XPOS backend base URL (e.g. `http://localhost:9003`)
   - `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` – Keycloak (same as backend)

3. **Run dev server**

   ```bash
   npm run dev
   ```

   App runs at `http://localhost:5173`. Vite proxy forwards `/api` to the backend when using relative URLs (configure proxy target in `vite.config.ts` if needed).

## Scripts

- `npm run dev` – start dev server
- `npm run build` – TypeScript check + production build
- `npm run preview` – serve production build locally
- `npm run lint` – run ESLint

## Project structure

- `src/api/` – API client (base URL, auth header, X-Request-Id, error parsing)
- `src/store/` – Redux store and slices (auth, orgContext)
- `src/features/` – admin, operator, auth, home
- `src/components/` – shared UI (Layout, etc.)
- `src/hooks/`, `src/types/`, `src/utils/` – shared hooks, API types, helpers
- `docs/` – FRONTEND_IMPLEMENTATION.md, FRONTEND_SUGGESTIONS.md, CURSOR_RULES_FULL.md
- `.cursor/rules/project.mdc` – Cursor AI rules for this repo

## Backend

The XPOS backend is in the sibling repo **xpos**. API reference and E2E flow:

- `xpos/docs/E2E_FULL_API_REFERENCE.md` – all endpoints
- `xpos/docs/E2E_POSTMAN_GUIDE.md` – flow and example bodies

Ensure the backend is running and CORS (or Vite proxy) is configured for this UI origin.
