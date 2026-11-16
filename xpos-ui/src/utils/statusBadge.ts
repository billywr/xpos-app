import type { badgeVariants } from "@/components/ui/styles";

export type BadgeVariant = keyof typeof badgeVariants;

const SUCCESS_STATUSES = new Set(["ACTIVE", "OPEN", "COMPLETED", "SETTLED", "PAID"]);
const INACTIVE_STATUSES = new Set(["INACTIVE", "CLOSED", "CANCELLED"]);
const WARNING_STATUSES = new Set(["PARTIAL", "PENDING", "DRAFT"]);
const DANGER_STATUSES = new Set(["OVERDUE", "FAILED", "REJECTED"]);

/** Map a backend status string to a badge variant. */
export function getStatusBadgeVariant(status: string): BadgeVariant {
  const upper = status.toUpperCase();
  if (DANGER_STATUSES.has(upper)) {
    return "danger";
  }
  if (WARNING_STATUSES.has(upper)) {
    return "warning";
  }
  if (SUCCESS_STATUSES.has(upper)) {
    return "success";
  }
  if (INACTIVE_STATUSES.has(upper)) {
    return "neutral";
  }
  return "neutral";
}
