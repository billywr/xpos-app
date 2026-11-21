import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { toSentenceCase } from "@/utils/textCase";
import { badgeBase, badgeVariants } from "./styles";
import { getStatusBadgeVariant, type BadgeVariant } from "@/utils/statusBadge";

export type { BadgeVariant };

export interface BadgeProps {
  variant?: BadgeVariant;
  /** When set, variant is derived from status string. */
  status?: string;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ variant, status, children, className, title }: BadgeProps) {
  const resolvedVariant = variant ?? (status ? getStatusBadgeVariant(status) : "neutral");
  const displayContent = typeof children === "string" ? toSentenceCase(children) : children;
  return (
    <span title={title} className={cn(badgeBase, badgeVariants[resolvedVariant], className)}>
      {displayContent}
    </span>
  );
}
