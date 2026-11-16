---
name: xpos-tailwind-theming
description: XPOS UI Tailwind, responsive layout, and four dark-theme variants. Use when styling pages, tables, forms, or fixing theme/responsive issues in xpos-ui.
---

# XPOS Tailwind & Theming

## Dark Themes (required on every new page)

Four variants selectable in Admin Settings: Ocean (default), Magenta, Midnight, Slate.

- Applied via `<html data-theme="...">`; `src/index.css` remaps `dark:bg-slate-*`, `dark:border-slate-*`, `dark:bg-primary-*` to CSS variables.
- Cards/tables/modals: `dark:bg-slate-800`
- Inputs, table headers, secondary buttons: `dark:bg-slate-700`
- Inline inputs: `dark:bg-slate-600`
- Page chrome: `dark:bg-slate-900`
- Borders/dividers: `dark:border-slate-600` or `-700`, `dark:divide-slate-600`
- Hover: `dark:hover:bg-slate-700` (or `/40`, `/30`)
- Accents: `bg-primary-500`/`-600`, `dark:bg-primary-500`/`-600`
- Do **not** use legacy `dark:bg-darkBg`, `dark:bg-darkSurface`, `dark:bg-darkNav` on new code.

Verify visually under each theme before finishing.

## Responsive

- Always use `sm:`, `md:`, `lg:`, `xl:` for layout and visibility.
- Min 44px touch targets on operator/cashier screens.
- Truncate or scroll — never fixed pixel widths that break mobile.

## Tables with Money

- Column header: `(KSH)`; cells: `formatAmount()` (no symbol per row).
- Left-align amount columns.
