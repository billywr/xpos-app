import { cn } from "@/utils/cn";

export interface ProgressBarProps {
  /** Value between 0 and 100 for determinate progress. If omitted or indeterminate=true, displays indeterminate animation. */
  value?: number;
  indeterminate?: boolean;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  /** Height size: 'xs' (h-0.5), 'sm' (h-1), 'md' (h-1.5), 'lg' (h-2.5). Default is 'md'. */
  size?: "xs" | "sm" | "md" | "lg";
  /** Optional label displayed above the progress bar */
  label?: string;
  /** Optional secondary label displayed on the right above the progress bar */
  sublabel?: string;
}

const sizeClasses = {
  xs: "h-0.5",
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2.5",
};

/**
 * Modern progress bar supporting determinate percentage or fluid indeterminate animation.
 * Optimized for network loading states, long-running processes, and modals.
 */
export function ProgressBar({
  value,
  indeterminate,
  className,
  trackClassName,
  barClassName,
  size = "md",
  label,
  sublabel,
}: ProgressBarProps) {
  const isIndeterminate = indeterminate ?? value === undefined;
  const clampedValue = typeof value === "number" ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div className={cn("w-full", className)}>
      {(label || sublabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
          {label ? <span>{label}</span> : <span />}
          {sublabel ? <span className="text-slate-500 dark:text-slate-400">{sublabel}</span> : null}
        </div>
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/80",
          sizeClasses[size],
          trackClassName
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isIndeterminate ? undefined : Math.round(clampedValue)}
      >
        {isIndeterminate ? (
          <>
            <div
              className={cn(
                "animate-indeterminate-1 rounded-full bg-primary-600 dark:bg-primary-500",
                barClassName
              )}
            />
            <div
              className={cn(
                "animate-indeterminate-2 rounded-full bg-primary-400 dark:bg-primary-400",
                barClassName
              )}
            />
          </>
        ) : (
          <div
            className={cn(
              "h-full rounded-full bg-primary-600 transition-all duration-300 ease-out dark:bg-primary-500",
              barClassName
            )}
            style={{ width: `${clampedValue}%` }}
          />
        )}
      </div>
    </div>
  );
}
