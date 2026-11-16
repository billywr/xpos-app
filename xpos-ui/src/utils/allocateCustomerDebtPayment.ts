import type { CustomerDebtResponse } from "@/api/debts";

export interface DebtAllocationPreviewLine {
  debtId: string;
  createdAt: string;
  amount: number;
  outstandingBefore: number;
  appliedAmount: number;
  outstandingAfter: number;
  status: string;
}

export interface DebtAllocationPreview {
  paymentAmount: number;
  totalApplied: number;
  unallocated: number;
  allocations: DebtAllocationPreviewLine[];
}

function isUnsettledDebt(debt: CustomerDebtResponse): boolean {
  return debt.status === "OPEN" || debt.status === "PARTIAL";
}

/** Case-insensitive trimmed name — matches backend bulk settle-by-name. */
export function normalizeCustomerName(name: string): string {
  return name.trim().toLowerCase();
}

/** Preview lump-sum allocation oldest-first by createdAt (matches backend FIFO). */
export function allocateCustomerDebtPayment(
  debts: CustomerDebtResponse[],
  paymentAmount: number
): DebtAllocationPreview | null {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return null;
  }

  const openDebts = debts
    .filter(isUnsettledDebt)
    .filter((d) => (d.outstanding ?? 0) > 0)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  if (openDebts.length === 0) {
    return null;
  }

  let remaining = paymentAmount;
  const allocations: DebtAllocationPreviewLine[] = [];

  for (const debt of openDebts) {
    if (remaining <= 0) {
      break;
    }
    const outstandingBefore = debt.outstanding ?? 0;
    const appliedAmount = Math.min(remaining, outstandingBefore);
    const outstandingAfter = outstandingBefore - appliedAmount;
    const status =
      outstandingAfter <= 0
        ? "CLOSED"
        : appliedAmount > 0 || (debt.amountSettled ?? 0) > 0
          ? "PARTIAL"
          : "OPEN";
    allocations.push({
      debtId: debt.id,
      createdAt: debt.createdAt,
      amount: debt.amount,
      outstandingBefore,
      appliedAmount,
      outstandingAfter,
      status,
    });
    remaining -= appliedAmount;
  }

  return {
    paymentAmount,
    totalApplied: paymentAmount - remaining,
    unallocated: remaining,
    allocations,
  };
}

export function customerTotalOutstanding(debts: CustomerDebtResponse[]): number {
  return debts
    .filter(isUnsettledDebt)
    .reduce((sum, d) => sum + (d.outstanding ?? 0), 0);
}
