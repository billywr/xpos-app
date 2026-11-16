import { AlertCircle } from "lucide-react";
import type { ApiError } from "@/types/api";
import { IconButton } from "@/components/ui/IconButton";

interface ErrorBannerProps {
  error: ApiError | null;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ error, onDismiss, className = "" }: ErrorBannerProps) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 ${className}`}
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{error.message}</p>
        {error.requestId && (
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Reference: {error.requestId}
          </p>
        )}
        {error.details && error.details.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm">
            {error.details.map((d, i) => (
              <li key={i}>
                {d.field ? `${d.field}: ` : ""}
                {d.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onDismiss && (
        <IconButton
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/40"
        >
          <span className="text-lg leading-none">×</span>
        </IconButton>
      )}
    </div>
  );
}
