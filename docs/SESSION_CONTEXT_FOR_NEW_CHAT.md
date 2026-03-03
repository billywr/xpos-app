# XPOS UI Session Context — Handoff for New Chat

**Date:** March 2025  
**Use this file when starting a new chat** to restore full context from the previous session.

---

## Project Overview

- **xpos-ui:** React frontend for XPOS (Kenya POS)
- **Stack:** React, Vite, TypeScript, Tailwind, Lucide React, Redux Toolkit, React Router
- **API:** `VITE_API_BASE_URL`, `src/api/client.ts` (apiFetch, token, X-Request-Id)
- **Types:** `src/types/api.ts` (ApiError, PageResponse)
- **Rules:** `.cursor/rules/project.mdc`

---

## Work Completed in This Session

### 1. Price List Edit — Full Page
- **Route:** `/admin/price-lists/:priceListId` (orgId in query: `?orgId=…`)
- **PriceListEditPage** (`src/features/admin/PriceListEditPage.tsx`):
  - Header form: name, branch, channel, priority, active + Save
  - Paginated table of menu item prices with inline edit (pencil → input + Save/Cancel), delete per row
  - Add-item form at bottom (item select, price, Add)
  - Pagination: size options [10, 25, 50, 100]
  - Pre-selects item in add form when `itemId` in URL (from Items page "Add price" link)

### 2. Price Lists List Page
- **Edit:** Links to `/admin/price-lists/:id?orgId=…` (and `&itemId=…` when coming from Items)
- **SlideOver:** Only for Add price list (no item management in modal)
- **orgId/itemId from URL:** Uses `useSearchParams` to sync org and pass itemId to edit links

### 3. Items List Page
- **Category filter:** Searchable dropdown (type to filter) with "All categories" option
- **Removed:** Category column and category group headers; flat table
- **No purchase history:** Amber row styling; tooltip on row
- **Add price vs Edit price:** Fetches `fetchItemIdsWithPrices`; tooltip shows "Edit price" when item has a price in any list, else "Add price"
- **Add price link:** Banknote icon → `/admin/price-lists?orgId=…&itemId=…`

### 4. Admin Sidebar (`src/components/AdminLayout.tsx`)
- **Categories:** Overview, Organization, Catalog, Sales, Inventory, Reports
- **Collapsible:** Click category to expand/collapse; chevron; active section auto-expands

### 5. Toast with Action Link
- **ToastContext / Toast:** `action?: { label: string; href: string }` — renders a Link in error toasts
- **Use:** `ITEM_NOT_SUPPLIED` error shows "Go to Goods Receipt →" with `href="/admin/goods-receipt?orgId=…"`

### 6. Items Page Links
- "No catalog items" and "All catalog items already have prices" — both have Link to `/admin/items`

---

## Key Paths

| Area | Path |
|------|------|
| Price list edit | `src/features/admin/PriceListEditPage.tsx` |
| Price lists list | `src/features/admin/PriceListsListPage.tsx` |
| Items list | `src/features/admin/ItemsListPage.tsx` |
| Admin sidebar | `src/components/AdminLayout.tsx` |
| Toast + action | `src/components/ui/Toast.tsx`, `src/contexts/ToastContext.tsx` |
| Items API | `src/api/items.ts` |
| Price lists API | `src/api/priceLists.ts` |
| API client | `src/api/client.ts` |
| ApiError utils | `src/utils/apiError.ts` (getApiErrorMessage, getApiErrorCode, getApiErrorRequestId) |

---

## API Usage

- **fetchItems:** `categoryId` param for filter
- **fetchItemIdsWithPrices:** For "Edit price" vs "Add price" tooltip
- **fetchPriceListItems:** Paginated; returns `PageResponse<PriceListItem>`
- **updatePriceListItem:** PATCH for price update

---

## Conventions

- IDs are UUID strings
- Error handling: show backend message + requestId; 401 → logout; 403 → forbidden
- No star imports
- Form submit via `form="id"` on button when button is outside form
