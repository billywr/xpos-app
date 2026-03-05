/**
 * Shared floating 3D card style for menu/nav cards.
 * "Dancing" hover: lift, scale, subtle tilt, deeper shadow.
 */
export const FLOATING_MENU_CARD =
  "flex items-center gap-4 rounded-xl border border-slate-200/60 bg-white/95 p-5 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.08),0_12px_32px_-8px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12),0_20px_48px_-12px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-slate-800/95 dark:shadow-[0_4px_14px_-2px_rgba(0,0,0,0.3),0_12px_32px_-8px_rgba(0,0,0,0.4)] dark:hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.35),0_20px_48px_-12px_rgba(0,0,0,0.5)]";

/** For smaller cards (KPI, menu items) - same effect, tighter padding */
export const FLOATING_CARD =
  "rounded-xl border border-slate-200/60 bg-white/95 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.08),0_12px_32px_-8px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12),0_20px_48px_-12px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-slate-800/95 dark:shadow-[0_4px_14px_-2px_rgba(0,0,0,0.3),0_12px_32px_-8px_rgba(0,0,0,0.4)] dark:hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.35),0_20px_48px_-12px_rgba(0,0,0,0.5)]";
