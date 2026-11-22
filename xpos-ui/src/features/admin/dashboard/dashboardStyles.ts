/**
 * Shared 3D card styling constants for the Admin Dashboard.
 * Delivers tactile depth and elevation without any gradients.
 * Strictly compatible with XPOS light mode and all four dark themes (Ocean, Magenta, Midnight, Slate).
 */

export const DASHBOARD_CARD_3D =
  "rounded-xl border border-slate-200/90 bg-white p-5 " +
  "shadow-[0_4px_12px_rgba(0,0,0,0.05),0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] " +
  "transition-all duration-200 " +
  "hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.1),0_18px_36px_rgba(0,0,0,0.12)] " +
  "dark:border-slate-700/80 dark:bg-slate-800 " +
  "dark:shadow-[0_4px_14px_rgba(0,0,0,0.35),0_12px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] " +
  "dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_20px_42px_rgba(0,0,0,0.55)]";

export const DASHBOARD_CARD_STATIC_3D =
  "rounded-xl border border-slate-200/90 bg-white p-5 " +
  "shadow-[0_4px_12px_rgba(0,0,0,0.05),0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] " +
  "dark:border-slate-700/80 dark:bg-slate-800 " +
  "dark:shadow-[0_4px_14px_rgba(0,0,0,0.35),0_12px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]";
