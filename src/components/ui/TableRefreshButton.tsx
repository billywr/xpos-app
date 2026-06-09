import { RefreshCw } from "lucide-react";
import { IconButton } from "./IconButton";
import { cn } from "@/utils/cn";

export interface TableRefreshButtonProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Refetch control for paginated tables and list screens. */
export function TableRefreshButton({
  onRefresh,
  isRefreshing = false,
  className = "",
  "aria-label": ariaLabel = "Refresh table data",
}: TableRefreshButtonProps) {
  return (
    <IconButton
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label={ariaLabel}
      title="Refresh"
      className={cn("shrink-0", className)}
    >
      <RefreshCw
        className={cn("h-4 w-4 sm:h-5 sm:w-5", isRefreshing && "animate-spin")}
        aria-hidden
      />
    </IconButton>
  );
}
