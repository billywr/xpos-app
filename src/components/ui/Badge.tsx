import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { badgeBase, badgeVariants } from "./styles";
import { getStatusBadgeVariant, type BadgeVariant } from "@/utils/statusBadge";

export type { BadgeVariant };

export interface BadgeProps {
  variant?: BadgeVariant;
  /** When set, variant is derived from status string. */
  status?: string;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant, status, children, className }: BadgeProps) {
  const resolvedVariant = variant ?? (status ? getStatusBadgeVariant(status) : "neutral");
  return (
    <span className={cn(badgeBase, badgeVariants[resolvedVariant], className)}>
      {children}
    </span>
  );
}
