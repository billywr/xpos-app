# XPOS UI – Implementation Phases

This document defines the phased rollout of the XPOS React UI. Each phase delivers a testable slice of functionality.

---

## Summary

| Phase | Focus | Items | Effort | Status |
|-------|-------|-------|--------|--------|
| A | Core POS + 401 | Modifier modal, 401 handling, operator tables page | 1–2 weeks | ✅ Done |
| B | Tables & customers | Admin table areas/tables, operator tables, customers (admin) | ~1 week | ✅ Done (customers: partial) |
| C | Receipts & print | Receipt view, print receipt | ~1 week | ✅ Done |
| D | Tax & pricing | Tax display, price overrides, promotions UI | ~1 week | ✅ Done (price lists; tax/promotions partial) |
| E | Inventory basics | Stock levels on Menu Order, block sale when out of stock, receiving, stock count UI | 1–2 weeks | 🔲 Pending |
| F | Cash & compliance | Cash drawer, day close, eTIMS/config UI | ~1 week | ✅ Done (shifts, cash movements, day close, Z-report) |
| G | Ledger & audit | Ledger entries, audit log viewer | ~1 week | 🔲 Pending |
| H | Operator polish | Idle logout, keyboard shortcuts, performance | ~1 week | ✅ Done (idle logout, theme, a11y) |
| I | Advanced / optional | E2E, offline, reporting, multi-lang, etc. | 2+ weeks | ✅ E2E done; rest pending |

Status legend: ✅ Done, 🔲 Pending. See detailed phase sections below.

---

## Phase 1: Auth and shell

**Goal:** User can log in and see a guarded app shell; unauthenticated users are sent to login.

| Item | Status | Notes |
|------|--------|--------|
| Keycloak token (password grant) | ✅ | POST to `/realms/{realm}/protocol/openid-connect/token`; store token + `sub` (iamUserId) in Redux |
| Login page | ✅ | Username/password form; on success store credentials and redirect |
| Auth guard | ✅ | Redirect to `/login` when no token and route requires auth |
| Logout | ✅ | Clear credentials; redirect to `/login` |
| Main layout (header + nav) | ✅ | Home, Admin, Operator links; user/logout when authenticated |
| Environment | ✅ | `VITE_KEYCLOAK_*`, `VITE_API_BASE_URL` in `.env.example` |

**Login flow (matches Keycloak token request):** POST to `{VITE_KEYCLOAK_URL}/realms/{realm}/protocol/openid-connect/token` with `Content-Type: application/x-www-form-urlencoded` and body: `grant_type=password`, `client_id=xpos-client-api` (or `VITE_KEYCLOAK_CLIENT_ID`), `username`, `password`. No `client_secret`. Response `access_token` is stored; JWT `sub` is used as `iamUserId`.

**Deliverable:** User logs in → lands on Home; visiting `/operator` or `/admin` without token → redirect to login.

---

## Phase 2: Operator context and POS

**Goal:** Operator can select org/branch/terminal and use the Menu Order flow end-to-end.

| Item | Status | Notes |
|------|--------|--------|
| Org/branch/terminal selection | ✅ | `/select-context`: pick org → branch → terminal (admin orgs/branches/terminals APIs); persist in Redux + sessionStorage; OperatorContextGuard requires context for `/operator` |
| Operator layout (sidebar + header) | ✅ | Dark theme; nav: Dashboard, Menu Order, Manage Table, etc. |
| Menu Order screen | ✅ | Categories, item grid, cart, order type, table select |
| Cart state (Redux) | ✅ | Lines, order type, table, price list, sale id |
| Confirm payment | ✅ | Create sale → add lines → add tender → complete; clear cart |
| Tables API (operator list) | ✅ | Backend + UI dropdown |
| Price list / tender types | ✅ | Used for pricing and default CASH tender |

**Deliverable:** Operator selects context → Menu Order → add items → select table → Confirm payment → sale completed.

---

## Phase 2b: Receipts & print (Phase C)

**Goal:** Show receipt after sale completion; support print.

| Item | Status | Notes |
|------|--------|--------|
| Receipt view | ✅ | Modal after complete payment; displays receipt number, date, lines, modifiers, subtotal, tax, total, tenders, change |
| Print receipt | ✅ | Print button opens receipt in new window and triggers `window.print()`; styled for thermal/receipt width (72mm) |

**Deliverable:** Operator completes sale → receipt modal appears → can view or print.

---

## Phase 3: Admin and org setup

**Goal:** Admin can manage orgs, branches, terminals, and catalog.

| Item | Status | Notes |
|------|--------|--------|
| Admin layout | ✅ | Sidebar nav: Dashboard, Orgs, Branches, Terminals, Staff, Catalog, Items, Price lists; collapsible sidebar |
| Orgs CRUD | ✅ | List with pagination; create/edit in slide-over; deactivate with confirm dialog |
| Branches CRUD | ✅ | Per-org; org selector, list with pagination; create/edit in slide-over (name, business, timezone, currency); deactivate with confirm |
| Terminals CRUD | ✅ | Per-branch; org + branch selector, list with pagination; create/edit in slide-over (code, printer); bind device in slide-over |
| Devices | ✅ | Org selector, list with pagination; register in slide-over (branch, deviceId, optional fingerprint); activate/deactivate with confirm + toasts |
| Staff users | ✅ | Org selector, list with pagination; register self (username); profile slide-over (displayName, phone, email, employeeNo, defaultBranch, status); branch assignments (list + add with primary); activate/deactivate with confirm + toasts |
| Categories CRUD | ✅ | Org selector, list with pagination; add/edit in slide-over (name, parent category, type: PRODUCT/MENU/SERVICE); invalidates operator categories |
| Items CRUD | ✅ | Org selector, list with pagination; add/edit slide-over (name, sku, type, category, UoM, tax profile, track inventory, active, image URL); edit: barcodes (add/remove), modifier groups (link/unlink); invalidates operator items |
| Price lists | ✅ | Org selector, list with pagination; add/edit price list (name, branch, channel, priority, active); edit: price list items (add item + price + currency, remove); invalidates operator price lists |
| Table areas / tables | ✅ | Backend APIs; admin UI |

**Deliverable:** Admin can configure org → branches → terminals → catalog and staff.

---

## Phase 4: Shifts, cash, and reporting

**Goal:** Operator shift lifecycle and basic cash/reporting visibility.

| Item | Status | Notes |
|------|--------|--------|
| Open / close shift | ✅ | Operator dashboard: open shift (opening float), close shift (closing counted amount); theme-aware UI |
| Cash movements | ✅ | Operator dashboard: Paid in / Paid out when shift open; list recent movements for current shift |
| Day close | ✅ | Operator dashboard: business date + Close day button (POST day-close) |
| Z-report (admin) | ✅ | Admin → Z-Report: org + branch + business date → load and display summary |
| Shifts list (admin) | ✅ | Admin → Shifts: org + branch selector, paginated table (opened/closed at, status, float, closing, variance) |

**Deliverable:** Operator opens shift → runs sales → closes shift; admin can view shifts and Z-report.

---

## Phase 5: Polish and scale

**Goal:** Production-ready UX, performance, and resilience.

| Item | Status | Notes |
|------|--------|--------|
| §11 UX standards | ✅ | Slide-over forms, confirm dialog, pagination, idle logout (5 min), collapsible sidebar, dark/light theme; Operator layout + Menu Order support both themes with toggle in header |
| Modifier modal (add item) | ✅ | When item has modifier groups; send modifiers in sale line |
| Error banner (global) | ✅ | Show backend message + requestId |
| 401 handling | ✅ | apiFetch interceptor; clear token, redirect to login |
| Loading / empty states | ✅ | Skeletons, disabled buttons |
| Responsive + a11y | ✅ | Breakpoints, ARIA, keyboard |
| Unit / integration tests | ✅ | formatCurrency; expand to auth + API flows |
| E2E (optional) | ✅ | Playwright: smoke (login, redirect), sale-flow (login → org → one sale) |

**Deliverable:** Reliable error handling, 401 → login, modifiers in POS, tests for critical paths.

---

## Phase E: Inventory basics (stock tracking for POS)

**Goal:** Operator sees stock levels on Menu Order; cannot sell when out of stock. Kenya-friendly, industry-standard UX.

**Depends on:** Backend Phase G (xpos IMPLEMENTATION_PLAN) – operator stock-levels API, sale complete enforces stock check.

| Item | Status | Notes |
|------|--------|-------|
| Stock levels on items | 🔲 | Menu Order: show "X in stock" or "Out of stock" for items with `trackInventory`. Fetch via `GET .../items/stock-levels` or items response enrichment. |
| Block sale when out of stock | 🔲 | Disable or gray out items with 0 stock; show "Hakuna stock" / "Out of stock" badge. Prevent add-to-cart when qty &gt; available. |
| Proceed to payment validation | 🔲 | Before create sale: if any cart line has insufficient stock, show error: "Insufficient stock for [item]. Only [available] remaining." User-friendly, Kenya Swahili option: "Hakuna stock ya [item]. Ni [available] peke yake." |
| Receiving (GRN) admin UI | ✅ | Admin → Goods Receipt: create GRN with lines; increases stock. Suppliers page for managing suppliers. |
| Stock count admin UI | 🔲 | Admin → Stock count: start session, add counted lines, close; view variance. |
| Inventory balance view (admin) | 🔲 | Admin → Inventory → Stock levels: per-branch, per-item on-hand qty. |

**UX guidelines (Kenya, industry std):**

- Use clear, short messages. Prefer "Out of stock" over "Insufficient inventory quantity".
- Optional Swahili for operators: "Hakuna stock" (no stock), "Ni X peke yake" (only X left).
- Visual: red badge or disabled state for out-of-stock; amber for low stock (e.g. &lt; 3) if configurable.
- Never allow sale to complete when stock is insufficient – backend enforces; UI prevents navigation to payment when cart exceeds available stock.

**Deliverable:** Add 2 beers via GRN → Menu Order shows "2 in stock". Sell 1 → shows "1 in stock". Try to sell 2 when 1 left → blocked with clear message.

---

## Phase mapping (Summary → detailed)

- **Phase A (Core POS + 401):** Phase 1–2 auth/shell + Menu Order + modifiers + 401 handling.
- **Phase B (Tables & customers):** Phase 3 table areas/tables; operator table selection; customers as needed.
- **Phase C (Receipts & print):** Phase 2b receipt modal + print.
- **Phase D–E:** Tax/pricing polish, inventory basics (stock levels, block sale when out of stock). Backend: Phase G in xpos IMPLEMENTATION_PLAN.
- **Phase F (Cash & compliance):** Phase 4 shifts, cash movements, day close, Z-report.
- **Phase G–H:** Ledger/audit, operator polish (idle logout, shortcuts).
- **Phase I (Advanced):** Phase 5 E2E; offline, reporting, multi-lang as future work.

Status legend: ✅ Done, 🔲 Pending.
