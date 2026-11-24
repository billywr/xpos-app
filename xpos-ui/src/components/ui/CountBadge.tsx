import { cn } from "@/utils/cn";

export type CountBadgeVariant =
  | "neutral"
  | "primary"
  | "amber"
  | "indigo"
  | "emerald"
  | "danger"
  | "muted";

export interface CountBadgeProps {
  count: number | string;
  variant?: CountBadgeVariant;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}

const variantStyles: Record<
  CountBadgeVariant,
  {
    active: string;
    inactive: string;
  }
> = {
  neutral: {
    active: "bg-slate-700 text-slate-100 dark:bg-slate-200 dark:text-slate-900",
    inactive: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  },
  primary: {
    active: "bg-primary-700 text-white shadow-xs dark:bg-primary-600 dark:text-white",
    inactive:
      "bg-primary-100 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300 dark:border dark:border-primary-800/50",
  },
  amber: {
    active: "bg-amber-700 text-amber-50 shadow-xs dark:bg-amber-600 dark:text-white",
    inactive:
      "bg-amber-200/90 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/30",
  },
  indigo: {
    active: "bg-indigo-700 text-indigo-50 shadow-xs dark:bg-indigo-600 dark:text-white",
    inactive:
      "bg-indigo-200/90 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border dark:border-indigo-500/30",
  },
  emerald: {
    active: "bg-emerald-700 text-emerald-50 dark:bg-emerald-600 dark:text-white",
    inactive:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/30",
  },
  danger: {
    active: "bg-red-700 text-red-50 dark:bg-red-600 dark:text-white",
    inactive:
      "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 dark:border dark:border-red-500/30",
  },
  muted: {
    active: "bg-slate-600 text-white dark:bg-slate-300 dark:text-slate-900",
    inactive: "bg-slate-200/80 text-slate-600 dark:bg-slate-700/80 dark:text-slate-300",
  },
};

const sizeStyles: Record<
  "sm" | "md" | "lg",
  {
    single: string;
    multi: string;
  }
> = {
  sm: {
    single: "w-[1.125rem] h-[1.125rem] min-w-[1.125rem] px-0 pb-0 pt-[0.5px] text-[10px] aspect-square",
    multi: "min-w-[1.125rem] h-[1.125rem] px-1 pb-0 pt-[0.5px] text-[10px]",
  },
  md: {
    single: "w-5 h-5 min-w-5 px-0 pb-0 pt-[1px] text-xs aspect-square",
    multi: "min-w-5 h-5 px-1.5 pb-0 pt-[1px] text-xs",
  },
  lg: {
    single: "w-6 h-6 min-w-6 px-0 pb-0 pt-[1px] text-xs aspect-square",
    multi: "min-w-6 h-6 px-2 pb-0 pt-[1px] text-xs",
  },
};

/**
 * A round badge for numeric counts inside buttons, tabs, category pills, and section headers.
 * Renders as a true circle for single digits and smoothly expands to a pill for multi-digit numbers,
 * with optical vertical centering for balanced glyph placement.
 */
export function CountBadge({
  count,
  variant = "neutral",
  active = false,
  size = "md",
  className,
  title,
}: CountBadgeProps) {
  const styles = variantStyles[variant] ?? variantStyles.neutral;
  const currentVariantClass = active ? styles.active : styles.inactive;

  const countStr = String(count);
  const isSingleDigit = countStr.length === 1;
  const sizeConfig = sizeStyles[size] ?? sizeStyles.md;
  const sizeClass = isSingleDigit ? sizeConfig.single : sizeConfig.multi;

  return (
    <span
      title={title}
      aria-label={typeof count === "number" ? `${count} items` : countStr}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-center rounded-full font-bold tabular-nums leading-none tracking-normal select-none transition-colors",
        sizeClass,
        currentVariantClass,
        className
      )}
    >
      {count}
    </span>
  );
}
