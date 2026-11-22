/** Canonical UI class strings — single source of truth for primitives and gradual page migration. */

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-800";

export const buttonVariants = {
  primary:
    "bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus:ring-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600",
  secondary:
    "border border-slate-300 bg-slate-100 text-slate-700 shadow-sm hover:bg-slate-200 hover:border-slate-400 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 dark:hover:border-slate-500",
  ghost:
    "text-slate-600 hover:bg-slate-100 focus:ring-slate-500 dark:text-slate-400 dark:hover:bg-slate-700",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-700",
  outline:
    "border border-primary-500 bg-transparent text-primary-600 hover:bg-primary-50 focus:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-950/30",
  neutral:
    "bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500 dark:bg-slate-600 dark:hover:bg-slate-700",
} as const;

export const buttonSizes = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-base",
  lg: "px-5 py-3 text-base",
  icon: "p-2.5",
} as const;

export const iconButtonVariants = {
  ghost:
    "rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:disabled:hover:bg-transparent dark:focus:ring-offset-slate-800",
  bordered:
    "rounded-lg border border-slate-300 bg-slate-100 p-1.5 text-slate-700 shadow-sm hover:bg-slate-200 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:focus:ring-offset-slate-800",
  danger:
    "rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:text-red-400 dark:hover:bg-red-900/30 dark:focus:ring-offset-slate-800",
} as const;

export const badgeVariants = {
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  neutral:
    "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
} as const;

export const badgeBase =
  "inline-flex items-center justify-start rounded-full px-2 py-0.5 text-xs font-medium";

export const statChipBase =
  "stat-chip-surface inline-flex gap-1 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm transition-shadow dark:border-slate-600 dark:bg-slate-800/95 sm:gap-1.5 sm:px-6 sm:py-4";

export const statChipTones = {
  debt: "border-l-4 border-l-amber-500 stat-chip--debt",
  expense: "border-l-4 border-l-rose-500 stat-chip--expense",
  sales: "border-l-4 border-l-emerald-500 stat-chip--sales",
  neutral: "border-l-4 border-l-slate-400 stat-chip--neutral",
} as const;

export const statChipLabelTones = {
  debt: "text-xs font-medium text-amber-700 dark:text-amber-400",
  expense: "text-xs font-medium text-rose-700 dark:text-rose-400",
  sales: "text-xs font-medium text-emerald-700 dark:text-emerald-400",
  neutral: "text-xs font-medium text-slate-600 dark:text-slate-400",
} as const;

export const statChipValueTones = {
  debt: "text-lg font-bold tabular-nums text-slate-900 sm:text-2xl dark:text-white",
  expense: "text-lg font-bold tabular-nums text-slate-900 sm:text-2xl dark:text-white",
  sales: "text-lg font-bold tabular-nums text-slate-900 sm:text-2xl dark:text-white",
  neutral: "text-lg font-bold tabular-nums text-slate-900 sm:text-2xl dark:text-white",
} as const;

export const modalOverlay =
  "fixed inset-0 z-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/60";

export const modalPanel =
  "relative z-10 w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800";

export const tableCard =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800";

export const tableHeadRow = "bg-slate-50 dark:bg-slate-700";

/** Debts & Expenses reference scale — use on all datatables except the frozen debts pages. */
export const tableHeadCell =
  "px-4 py-3 text-left text-lg font-semibold tracking-normal text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300";

/** Uniform row hover — pairs with .xpos-table-row rules in index.css */
export const tableBodyRow = "xpos-table-row";

/** Uniform alternating / zebra row styling — pairs with .xpos-table-row-zebra in index.css */
export const tableBodyRowZebra =
  "xpos-table-row-zebra bg-slate-50/60 dark:bg-slate-700/20";

export const tableBodyCell =
  "px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400";

export const tableBodyCellNum =
  "px-4 py-2 text-right text-lg tabular-nums text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400";

/** Debts & Expenses reference — numeric columns are left-aligned with tabular-nums. */
export const tableBodyCellNumDebts =
  "px-4 py-2 text-left text-lg tabular-nums text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400";

export const tableEmptyCell =
  "px-4 py-8 text-center text-lg text-slate-500 sm:px-6 sm:text-xl dark:text-slate-400";

/** Use on `<col>` in `table-fixed` layouts so the No. column stays narrow. */
export const tableRowNoCol = "w-[2.25rem]";

/** Inline width for `<col>` — Tailwind width classes are unreliable on col elements. */
export const tableRowNoColStyle = {
  width: "2.25rem",
  minWidth: "2.25rem",
  maxWidth: "2.25rem",
} as const;

export const tableRowNoHead =
  "box-border w-[2.25rem] min-w-[2.25rem] max-w-[2.25rem] px-0.5 py-3 text-center text-base font-semibold tracking-normal text-slate-700 sm:py-3 sm:text-lg dark:text-slate-300";

export const tableRowNoCell =
  "box-border w-[2.25rem] min-w-[2.25rem] max-w-[2.25rem] px-0.5 py-2 text-center text-base tabular-nums text-slate-600 sm:py-2.5 sm:text-lg dark:text-slate-400";

export const tableStickyFirstCell =
  "xpos-table-sticky-first sticky left-0 z-10";

export const tableStickyFirstBody =
  `${tableStickyFirstCell} px-4 py-2 text-lg font-bold text-slate-900 sm:px-6 sm:py-2.5 sm:text-xl dark:text-white`;

export const tableStickyHeadCell =
  "xpos-table-sticky-head sticky left-0 z-20";

export const formLabel =
  "block text-sm font-medium text-slate-700 dark:text-slate-300";

export const navActive =
  "bg-primary-600 text-white dark:bg-primary-500";

export const navInactive =
  "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white";
